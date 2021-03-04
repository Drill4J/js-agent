/*
 * Copyright 2020 EPAM Systems
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/indent */
/* eslint-disable import/no-unresolved */
import R from 'ramda';
import { assert } from 'console';
import { ExecClassData } from '@drill4j/test2code-types';
import fsExtra from 'fs-extra';
import convertSourceMap from 'convert-source-map';
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import LoggerProvider from '../../../../../../util/logger';
import {
  AstEntity,
  RawSourceString,
  ScriptName,
  V8CoverageRange,
  V8FunctionCoverage,
  V8ScriptCoverage,
  OriginalSourceCoverage,
  Location,
  MethodLocation,
} from '../types';
import { extractScriptNameFromUrl } from '../util';
import originalToExecClass from './original-to-exec-class';
import rawToOriginal from './raw-to-original';
import v8ToRaw from './v8-to-raw';
import Source from './lib/source';
import normalizeScriptPath from '../../../../../../util/normalize-script-path';

const logger = LoggerProvider.getLogger('drill', 'coverage-processor');

function rangeMapSimple(range: V8CoverageRange, cache: any) {
  const { startOffset, endOffset, count } = range;
  return {
    count,
    ...cache.source.offsetOriginalToRelativeNoSourcemap(startOffset, endOffset, cache.originalFilePath),
  };
}

function rangeMapWithSourcemap(range: V8CoverageRange, cache: any) {
  const { startOffset, endOffset } = range;
  let originalPosition;
  if (cache.mappings[`${startOffset}/${endOffset}`]) {
    originalPosition = cache.mappings[`${startOffset}/${endOffset}`];
  } else {
    originalPosition = cache.source.offsetToOriginalRelative(cache.sourceMapConsumer, startOffset, endOffset);
    // eslint-disable-next-line no-param-reassign
    cache.mappings[`${startOffset}/${endOffset}`] = originalPosition;
  }

  const rangeNotInOriginalSource = Object.keys(originalPosition).length === 0;
  if (rangeNotInOriginalSource) {
    return null;
  }

  return {
    ...originalPosition,
    count: range.count,
  };
}

export default async function convert(
  v8coverage: V8ScriptCoverage[],
  sourceMapPath: string,
  astEntities: AstEntity[],
  testName: string,
  cache: Record<string, any>,
): Promise<ExecClassData[]> {
  const dirDate = Date.now();
  await fsExtra.ensureDir(`./out/raw/${dirDate}/${testName}`);
  await fsExtra.ensureDir(`./out/exec-class/${dirDate}`);
  // 0. Prepare source & source map
  await Promise.all(
    v8coverage.map(async v8ScriptCoverage => {
      const { sourceHash, scriptId, functions } = v8ScriptCoverage;
      if (cache[sourceHash]) return;

      const { source: rawSource, url } = v8ScriptCoverage;
      const source = new Source(rawSource);
      // FIXME SOURCE_ROOT is set in js-ast-parser config, get it from there
      // that is used ONLY when coverage mapping is disabled
      const originalFilePath = url.indexOf(process.env.SOURCE_ROOT) === 0 && url.substring(process.env.SOURCE_ROOT.length, url.length);

      const scriptName = extractScriptNameFromUrl(url);
      await fsExtra.writeJSON(`./out/raw/${dirDate}/${testName}/${scriptName}.json`, { sourceHash, scriptId, functions }, { spaces: 2 });

      // eslint-disable-next-line no-param-reassign
      cache[sourceHash] = {
        originalFilePath,
        source,
        mappings: {},
        sourceMapConsumer:
          process.env.SKIP_SOURCE_MAPPING !== 'true' &&
          // FIXME                                             crawl sourcemaps contents for original  file names
          (await new SourceMapConsumer(getSourceMap(rawSource, scriptName, sourceMapPath))),
      };
    }),
  );

  // 1. Convert function ranges
  let coverage1;
  if (process.env.SKIP_SOURCE_MAPPING === 'true') {
    // - if sourcemapping disabled - from absolute offsets to relative lines and columns
    coverage1 = v8coverage.map<V8ScriptCoverage>(v8ScriptCoverage => {
      const { functions, sourceHash } = v8ScriptCoverage;
      return {
        ...v8ScriptCoverage,
        sourceHash,
        functions: functions.map(fn => ({
          ...fn,
          location: rangeMapSimple(fn.ranges[0], cache[sourceHash]),
          ranges: fn.ranges.map(range => rangeMapSimple(range, cache[sourceHash])),
        })),
      };
    });
  } else {
    // - if sourcemapping enabled  - from absolute offsets in transpiled code to relative lines and columns in the original source files
    coverage1 = v8coverage.map<V8ScriptCoverage>(v8ScriptCoverage => {
      const { functions, sourceHash } = v8ScriptCoverage;
      return {
        ...v8ScriptCoverage,
        sourceHash,
        functions: functions
          .map<V8FunctionCoverage>(fn => {
            // FIXME this is horrible :(
            const location = rangeMapWithSourcemap(fn.ranges[0], cache[sourceHash]);

            // FIXME null location for the whole file range (todomvc 0 - 8929)
            if (isPrefixOmissionEnabled() && location) {
              location.source = omitPrefix(location.source);
            }
            if (isPrefixAppendageEnabled() && location) {
              location.source = appendPrefix(location.source);
            }

            return {
              ...fn,
              location,
              ranges: fn.ranges
                .map(range => rangeMapWithSourcemap(range, cache[sourceHash]))
                // 2. Filter ranges not present in the original source files (bundler generated boilerplate & node_modules sources)
                .filter(range => range && range.source && !range.source.includes('node_modules'))
                // 3. Apply source path transformations if needed
                // FIXME move conditional "up", to avoid evaluation each time ranges are mapped (it's pointless)
                .map(R.when(isPrefixOmissionEnabled, range => ({ ...range, source: omitPrefix(range.source) })))
                .map(R.when(isPrefixAppendageEnabled, range => ({ ...range, source: appendPrefix(range.source) }))),
            };
          })
          .filter(fn => (fn as any).location), // filter out function coverage not present in the original source
      };
    });
  }

  // если transpiled range --> sourcemap --> lines != original lines (from AST parser)
  // is   transpiled range --> sourcemap --> lines == original range (from AST parser) ---> generated lines ---> original lines

  // // const fnsCoverage = R.flatten(R.map(R.prop('functions'), coverage));
  // const coverage2 = coverage1.map(x => {
  //   return {
  //     ...x,
  //     functionsByLocations: x.functions.reduce((a, fn) => {
  //       const key = locationToKey(fn.location);
  //       if (!a[key]) {
  //         // eslint-disable-next-line no-param-reassign
  //         a[key] = fn;
  //       } else {
  //         // eslint-disable-next-line no-param-reassign
  //         a[key].ranges = a[key].ranges.concat(fn.ranges);
  //       }
  //       return a;
  //     }, {}),
  //   };
  // });

  // 3. Map coverage to format supported by Drill4J admin backend component
  const result = astEntities.map<ExecClassData>(astEntity => {
    const entityCoverage = coverage1
      .map(scriptCoverage => scriptCoverage.functions.filter(fn => fn.location?.source.includes(astEntity.filePath))) // FIXME null location
      .filter(scriptCoverage => scriptCoverage.length > 0);
    // const entityCoverage = coverage2.reduce(
    //   (acc, scriptCoverage) => {
    //     const functions = scriptCoverage.functions.filter(fn => fn.location?.source.includes(astEntity.filePath));
    //     return [...acc, ...functions];
    //   }, // FIXME null location
    //   [],
    // );

    const className = normalizeScriptPath(astEntity.filePath) + (astEntity.suffix ? `.${astEntity.suffix}` : '');

    let probes;
    if (entityCoverage.length === 0) {
      probes = astEntity.methods.reduce((a, method) => [...a, ...new Array(method.probes.length).fill(false)], []);
      // probes = astEntity.methods.reduce(
      //   (a, method) => [...a, ...method.probes.map(probe => ({ [`${probe.line}:${probe.column}`]: false }))],
      //   [],
      // );
    } else {
      // each entityCoverage element represents coverage from independent V8 isolates, thus they can be merged only after mapping
      const probesArrays = entityCoverage.map(cov => mapCoverageToEntityProbes2(astEntity, cov, cache));
      probes = mergeArrays(probesArrays, (a, b) => a || b);
    }
    return {
      id: undefined,
      className,
      probes,
      testName,
    };
  });

  await fsExtra.writeJSON(`./out/exec-class/${dirDate}/${testName}.json`, result, { spaces: 2 });

  // return [];
  return result;
}

function mergeArrays(arrays, elementMerger) {
  assert(
    arrays.every(arr => arr.length === arrays[0].length),
    'merging arrays must have the same length',
  );

  return arrays.reduce((acc, arr, index) => {
    if (index === 0) return acc;
    return acc.map((probe, i) => elementMerger(probe, arr[i]));
  }, arrays[0]);
}

function locationToKey(location) {
  const { startLine, relStartCol: startCol, endLine, relEndCol: endCol } = location;
  return `${startLine}/${startCol}-${endLine}/${endCol}`;
}

function mapCoverageToEntityProbes2(entity: AstEntity, entityCoverage, cache: any) {
  return entity.methods.reduce((result, method) => {
    // HACK because estree parser yields end position as position for character AFTER the node, even if there are no characters ahead
    //      that causes a root node to have the end pos residing at an empty line (with no characters at all)
    //      V8 + current sourcemapping implementation yeilds end pos on the previous line (only column is chaged)
    const methodCoverage = entityCoverage.filter(fn =>
      method.name === 'GLOBAL'
        ? fn.location.startLine === method.location.start.line && fn.location.relStartCol === method.location.start.column
        : compareLocations(fn.location, method.location),
    );
    // if (methodCoverage.length === 0) return [...result, ...method.probes.map(probe => ({ [`${probe.line}:${probe.column}`]: false }))];
    if (methodCoverage.length === 0) return [...result, ...new Array(method.probes.length).fill(false)];
    // eslint-disable-next-line no-param-reassign

    // FIXME reducing might lead to errors when methodCoverage has more than one item
    // THIS IS NOT RIGHT! If method ranges included single not covered range, that's gonna break
    const notCoveredRanges = methodCoverage.reduce((acc, part) => [...acc, ...part.ranges.filter(range => range.count === 0)], []);
    // const notCoveredRanges = methodCoverage.reduce((acc, part) => [...acc, ...part.ranges.slice(1, part.ranges.length)], []);
    return method.probes.reduce((acc, probe) => {
      acc.push(notCoveredRanges.findIndex(range => isProbeInsideRange(probe, range)) === -1);
      // acc.push({ [`${probe.line}:${probe.column}`]: notCoveredRanges.findIndex(range => isProbeInsideRange(probe, range)) === -1 });
      return acc;
    }, result);
  }, []);
}

function compareLocations(a, b) {
  // eslint-disable-next-line max-len
  // return a.start.line === b.start.line && a.start.column === b.start.column && a.end.line === b.end.line && a.end.column === b.end.column;
  if (b.start.column === 'Infinity') b.start.column = Infinity;
  if (b.end.column === 'Infinity') b.end.column = Infinity;
  return a.startLine === b.start.line && a.relStartCol === b.start.column && a.endLine === b.end.line && a.relEndCol === b.end.column;
}

function isProbeInsideRange(probe, range) {
  const isProbeLineInsideRange = probe.line >= range.startLine && probe.line <= range.endLine;
  if (!isProbeLineInsideRange) return false;

  const isSingleLineRange = range.startLine === range.endLine;
  if (isSingleLineRange) {
    return probe.column >= range.relStartCol && probe.column <= range.relEndCol;
  }

  if (probe.line === range.startLine) {
    return probe.column >= range.relStartCol;
  }
  if (probe.line === range.endLine) {
    return probe.column <= range.relEndCol;
  }

  // probe is inside range - line is in between range start & end lines
  // probe column is irrelevant
  return true;
}

function isPrefixOmissionEnabled() {
  return !!process.env.COVERAGE_SOURCE_OMIT_PREFIX;
}

function omitPrefix(str) {
  return str.replace(process.env.COVERAGE_SOURCE_OMIT_PREFIX, '');
}

function isPrefixAppendageEnabled() {
  return !!process.env.COVERAGE_SOURCE_APPEND_PREFIX;
}

function appendPrefix(str) {
  return `${process.env.COVERAGE_SOURCE_APPEND_PREFIX}${str}`;
}

function getSourceMap(source: RawSourceString, scriptName: ScriptName, sourceMapPath: string): RawSourceMap {
  const sourceMap = convertSourceMap.fromMapFileSource(source, sourceMapPath);
  const sourceMapExists = sourceMap?.sourcemap?.file?.includes(scriptName);
  if (!sourceMapExists) {
    logger.warning(`there is no source map for ${scriptName}`);
  }
  return sourceMap.sourcemap;
}
