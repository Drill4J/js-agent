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
import { AstMethod, ExecClassData } from '@drill4j/test2code-types';
import { assert } from 'console';
import fsExtra from 'fs-extra';
import upath from 'upath';
import convertSourceMap from 'convert-source-map';
import R from 'ramda';
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import LoggerProvider from '../../../../../util/logger';
import Source from './third-party/source';
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
  const rawScriptsCoverage = R.filter(hashFilter)(coverage);
  if (R.isEmpty(rawScriptsCoverage)) {
    // TODO think of a more descriptive message
    logger.warning('all coverage was filtered');
    return [];
  }

  const scriptsUrls = R.pipe(R.pluck('url'), R.uniq)(rawScriptsCoverage);
  const getMappingFnByUrl = await prepareMappingFns(sourceMapPath, bundlePath, cache)(urlToHash)(scriptsUrls);

  const obtainMappingFunction = R.pipe(R.prop('url'), getMappingFnByUrl);
  const scriptsCoverage = R.map(weirdPipe(obtainMappingFunction, transformCoverage))(rawScriptsCoverage);

  const mapEntityProbes = createProbeMapper(scriptsCoverage);
  const result = R.pipe(
    R.map((entity: AstEntity) => ({
      id: undefined,
      className: `${normalizeScriptPath(entity.filePath)}${entity.suffix ? `.${entity.suffix}` : ''}`,
      testName,
      probes: mapEntityProbes(entity),
    })),
    R.filter(passProbesNotNull),
  )(astEntities);

  if (process.env.DEBUG_PROBES_ENABLED === 'true') return writeAndStripDebugInfo(rawData, result, testName);
  return result;
}

const passProbesNotNull = R.pipe(R.prop('probes'), R.complement(R.isNil));

const writeAndStripDebugInfo = async (rawData, data, rawTestName): Promise<ExecClassData[]> => {
  const ts = Date.now();
  const testName = rawTestName.replace(/[/\\?%*:|"<>]/g, '-');
  const result = stripDebugInfoFromProbes(data);
  await fsExtra.ensureDir(`./out/${ts}`);
  await fsExtra.writeJSON(`./out/${ts}/${testName}-rawData.json`, rawData, { spaces: 2 });
  await fsExtra.writeJSON(`./out/${ts}/${testName}-debug.json`, data, { spaces: 2 });
  await fsExtra.writeJSON(`./out/${ts}/${testName}.json`, result, { spaces: 2 });
  return result;
};

const weirdPipe = (fn1, fn2) => data => fn2(fn1(data))(data); // TODO is there a matching function in R?

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

const createProbeMapper = scriptsCoverage => entity =>
  R.pipe(
    R.map(R.filter((covPart: any) => covPart.location.source === entity.filePath)),
    R.filter(passNotEmpty),
    R.ifElse(
      R.isEmpty,
      () => null,
      R.pipe(
        R.map(mapCoverageToEntity(entity)),
        mergeProbeCoverage, // TODO a better name. Merge script coverage? Overlay script coverage?
      ),
    ),
  )(scriptsCoverage);

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
    count, // TODO preserves count. hack-ish but fast
  });
};

const sourceIsNotNil = (x: any) => !R.isNil(x?.source);

const passNotEmpty = R.complement(R.isEmpty);

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

const passNotCovered = R.propEq('count', 0);

const passSameLocation = method => functionCoverage =>
  functionCoverage.location.startLine === method.location.start.line &&
  functionCoverage.location.relStartCol === method.location.start.column;

const allMethodProbesAre =
  process.env.DEBUG_PROBES_ENABLED === 'true'
    ? method => (value: boolean) => () => method.probes.map(probeDebugInfo(value))
    : method => value => () => createArray(method.probes.length)(value);

const allEntityProbesAre =
  process.env.DEBUG_PROBES_ENABLED === 'true'
    ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      entity => value => () => R.pipe(R.prop('methods'), R.pluck('probes'), R.flatten, R.map(probeDebugInfo(value)))(entity)
    : entity => (value: boolean) => () => createArray(entity.methods.reduce((a, x) => a + x.probes.length, 0))(value);

const createArray = length => value => new Array(length).fill(value);

const probeDebugInfo = isCovered => probe => ({ ...probe, isCovered });

/* HACK-ish implementation
    In most cases there is 1-to-1 mapping from transpiled function to the original function
    The relation is establish by __the function starting location__ (the exact line:column) obtained from sourcemap

    __Sometimes__ a single function in the original code may get transpiled to __multiple__ nested functions
    Example: https://babeljs.io/docs/en/babel-plugin-transform-regenerator

    All wrapping functions:
      - are sourcemapped to __the same original function starting position__
      - have 100% coverage
    
    That collides with the "real" probes placed in the original code (because of the same location)

    The solution: map coverage only from the innermost function
*/
const mapCoverageToMethod = entityCoverage => method =>
  R.pipe(
    R.filter(passSameLocation(method)),
    R.ifElse(
      R.isEmpty,
      allMethodProbesAre(method)(false),
      R.pipe(
        R.last,
        R.pipe(R.prop('ranges'), R.filter(passNotCovered), R.ifElse(R.isEmpty, allMethodProbesAre(method)(true), mapProbes(method.probes))),
      ),
    ),
  )(entityCoverage);

const mapCoverageToEntity = entity => entityCoverage => {
  return R.pipe(R.map(mapCoverageToMethod(entityCoverage)), R.flatten)(entity.methods);
};

const mapProbes =
  process.env.DEBUG_PROBES_ENABLED === 'true'
    ? probes => notCoveredRanges => probes.map(probe => probeDebugInfo(isProbeCovered(notCoveredRanges)(probe))(probe)) // TODO ugly
    : probes => notCoveredRanges => probes.map(isProbeCovered(notCoveredRanges));

const isProbeCovered = ranges => probe => ranges.findIndex(range => isProbeInsideRange(probe, range)) === -1;

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

const mergeProbeCoverage =
  process.env.DEBUG_PROBES_ENABLED === 'true'
    ? mergeArrays((a, b) => ({ ...a, isCovered: a.isCovered || b.isCovered }))
    : mergeArrays((a, b) => a || b);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const stripDebugInfoFromProbes = R.map(computeProperty('probes')(R.pipe(R.prop('probes'), R.map(R.prop('isCovered')))));
