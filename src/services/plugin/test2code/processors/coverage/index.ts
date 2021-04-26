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
/* eslint-disable import/no-unresolved */
import { ExecClassData } from '@drill4j/test2code-types';
import { assert } from 'console';
import fsExtra from 'fs-extra';
import upath from 'upath';
import convertSourceMap from 'convert-source-map';
import R, { tap } from 'ramda';
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import LoggerProvider from '../../../../../util/logger';
import Source from './convert/lib/source';
import { AstEntity, BundleHashes, BundleScriptNames, RawSourceString, Test, V8Coverage, V8ScriptCoverage } from './types';
import normalizeScriptPath from '../../../../../util/normalize-script-path';

export const logger = LoggerProvider.getLogger('drill', 'coverage-processor');

export default async function processCoverage(
  sourceMapPath: string,
  astEntities: AstEntity[],
  rawData: { coverage: V8Coverage; scriptSources: any; testName: string },
  bundlePath: string,
  bundleHashes: BundleHashes,
  bundleScriptNames: BundleScriptNames,
  cache: Record<string, any>,
): Promise<ExecClassData[]> {
  const {
    testName,
    coverage,
    scriptSources: { hashToUrl, urlToHash },
  } = rawData;

  if (!coverage || coverage.length === 0) {
    logger.warning('received empty coverage');
    return [];
  }

  const hashFilter = R.pipe(R.prop('url'), createHashFilter(bundleHashes)(hashToUrl));
  const scriptsCoverage = R.filter(hashFilter)(coverage);
  if (R.isEmpty(scriptsCoverage)) {
    // TODO think of a more descriptive message
    logger.warning('all coverage was filtered');
    return [];
  }

  const scriptsUrls = R.pipe(R.pluck('url'), R.uniq)(scriptsCoverage);
  const getMappingFnByUrl = await prepareMappingFns(sourceMapPath, bundlePath, cache)(urlToHash)(scriptsUrls);

  const transformCoverage = rangeMappingFn =>
    R.pipe(
      R.prop('functions'),
      R.map(computeProperty('location')(R.pipe(R.prop('ranges'), R.head, rangeMappingFn))), // TODO this is getting hard to read
      R.filter(R.pipe(R.prop('location'), R.allPass([sourceIsNotNil, sourceIsNotInNodeModules]))),
      R.map(computeProperty('location')(R.pipe(R.prop('location'), transformSource))),
      R.map(
        computeProperty('ranges')(
          R.pipe(
            R.prop('ranges'),
            R.map(rangeMappingFn),
            R.filter(R.allPass([sourceIsNotNil, sourceIsNotInNodeModules])),
            R.map(transformSource),
          ),
        ),
      ),
    );

  const weirdPipe = (fn1, fn2) => data => fn2(fn1(data))(data); // TODO is there a matching function in R?
  const obtainMappingFunction = R.pipe(R.prop('url'), getMappingFnByUrl);
  const fnCoverage = R.map(weirdPipe(obtainMappingFunction, transformCoverage))(scriptsCoverage);

  // const createAstEntityMapper = (fnCoverage: any[]) => (astEntities: AstEntity[]) {
  //   R.map(R.pipe(R.prop('filePath'), pathFilter, R.filter))
  // }
  // const pathFilter = fn => astEntityPath => fn.location?.source.includes(astEntityPath);
  // const mapToAst = createAstEntityMapper(sourcemappedCoverage);
  const create = coverage => (result, entity) =>
    R.append(
      {
        id: undefined,
        className: normalizeScriptPath(entity.filePath) + (entity.suffix ? `.${entity.suffix}` : ''),
        testName,
        probes: R.pipe(
          R.map(R.filter((covPart: any) => covPart.location.source === entity.filePath)),
          R.filter(isNotEmpty),
          R.map(mapCoverageToEntityProbes(entity)),
          mergeArrays((a, b) => a || b),
        )(coverage),
      },
      result,
    );
  const create2 = coverage => entity => ({
    id: undefined,
    className: normalizeScriptPath(entity.filePath) + (entity.suffix ? `.${entity.suffix}` : ''),
    testName,
    probes: R.pipe(
      R.map(R.filter((covPart: any) => covPart.location.source === entity.filePath)),
      R.filter(isNotEmpty),
      R.map(mapCoverageToEntityProbes(entity)),
      mergeArrays((a, b) => a || b),
    )(coverage),
  });

  // R.applySpec({
  //   id: undefined,
  //   className: normalizeScriptPath(entity.filePath) + (entity.suffix ? `.${entity.suffix}` : ''),
  // })

  const mapCoverageToProbes = create(fnCoverage);
  const mapCoverageToProbes2 = create2(fnCoverage);

  const res2 = R.pipe(R.map(mapCoverageToProbes2), R.reduce(R.append, []))(astEntities);
  const res = R.reduceBy(mapCoverageToProbes, [], R.prop('filePath'))(astEntities);

  return [];
}

// TODO refactor using lens? https://ramdajs.com/docs/#lens
const computeProperty = name => comp => data => ({
  ...data,
  [name]: comp(data),
});

const prepareMappingFns = (sourceMapPath, bundlePath, cache) => urlToHash => async scriptsUrls => {
  await Promise.all(
    R.map(async (url: string) => {
      if (cache[urlToHash[url]]) return;
      const scriptName = extractScriptName(url);
      const buf = await fsExtra.readFile(upath.join(bundlePath, scriptName));
      const rawSource = buf.toString('utf8');
      // eslint-disable-next-line no-param-reassign
      cache[urlToHash[url]] = new Source(rawSource, await new SourceMapConsumer(getSourceMap(sourceMapPath)(rawSource)));
      // TODO
      // const sourceMapExists = sourceMap?.sourcemap?.file?.includes(scriptName);
      // if (!sourceMapExists) {
      //   logger.warning(`there is no source map for ${scriptName}`);
      // }
    })(scriptsUrls),
  );

  return url => ({ startOffset, endOffset, count }) => ({
    ...cache[urlToHash[url]].getOriginalPosition(startOffset, endOffset),
    count, // TODO hack-ish but fast
  });
};

const sourceIsNotNil = (x: any) => !R.isNil(x?.source);

const isNotEmpty = R.complement(R.isEmpty);

const sourceIsNotInNodeModules = (x: any) => !x.source.includes('node_modules');

const createSourceTransformer = (prefixToOmit, newPrefix) => {
  if (prefixToOmit && newPrefix) {
    return computeProperty('source')(R.pipe(R.prop('source'), omitPrefix(prefixToOmit), appendPrefix(newPrefix)));
  }

  if (newPrefix) {
    return computeProperty('source')(R.pipe(R.prop('source'), appendPrefix(newPrefix)));
  }

  if (prefixToOmit) {
    return computeProperty('source')(R.pipe(R.prop('source'), omitPrefix(prefixToOmit)));
  }

  return R.identity;
};

const omitPrefix = prefix => str => str.replace(prefix, '');

const appendPrefix = prefix => str => `${prefix}${str}`;

// TODO set prefix to omit/new prefix in agent's settings (either in admin panel or ast-parser config)
const transformSource = createSourceTransformer(process.env.COVERAGE_SOURCE_OMIT_PREFIX, process.env.COVERAGE_SOURCE_APPEND_PREFIX);

const createHashFilter = bundleHashes => hashToUrl => {
  const scriptsUrls = bundleHashes.map(x => hashToUrl[x.hash]).filter(x => !!x);
  return url => url && scriptsUrls.includes(url);
};

const getSourceMap = (sourceMapPath: string) => (source: string): RawSourceMap =>
  convertSourceMap.fromMapFileSource(source, sourceMapPath).sourcemap;

const extractScriptName = url => url.substring(url.lastIndexOf('/') + 1) || undefined;

// const scriptNameFilter = R.pipe(R.prop('url'), extractScriptName, createScriptNameFilter(bundleScriptNames));
// const createScriptNameFilter = (scriptNames: string[]) => R.includes(R.__, scriptNames);

const mapCoverageToEntityProbes = (entity: AstEntity) => entityCoverage => {
  return entity.methods.reduce((result, method) => {
    // HACK because estree parser yields end position as position for character AFTER the node, even if there are no characters ahead
    //      that causes a root node to have the end pos residing at an empty line (with no characters at all)
    //      V8 + current sourcemapping implementation yeilds end pos on the previous line (only column is chaged)
    const methodCoverage = entityCoverage.filter(
      fn => fn.location.startLine === method.location.start.line && fn.location.relStartCol === method.location.start.column,
    );
    // if (methodCoverage.length === 0) return [...result, ...method.probes.map(probe => ({ [`${probe.line}:${probe.column}`]: false }))];
    if (methodCoverage.length === 0) return [...result, ...new Array(method.probes.length).fill(false)];

    const notCoveredRanges = methodCoverage.reduce((acc, part) => [...acc, ...part.ranges.filter(range => range.count === 0)], []);
    return method.probes.reduce((acc, probe) => {
      acc.push(notCoveredRanges.findIndex(range => isProbeInsideRange(probe, range)) === -1);
      // acc.push({ [`${probe.line}:${probe.column}`]: notCoveredRanges.findIndex(range => isProbeInsideRange(probe, range)) === -1 });
      return acc;
    }, result);
  }, []);
};

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

const mergeArrays = elementMerger => arrays => {
  assert(
    arrays.every(arr => arr.length === arrays[0].length),
    'merging arrays must have the same length',
  );

  return arrays.reduce((acc, arr, index) => {
    if (index === 0) return acc;
    return acc.map((probe, i) => elementMerger(probe, arr[i]));
  }, arrays[0]);
};
