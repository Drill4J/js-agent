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
import isEmpty from 'lodash.isempty';
import { assert } from 'console';
import fsExtra from 'fs-extra';
import R from 'ramda';
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import LoggerProvider from '@util/logger';
import normalizeScriptPath from '@util/normalize-script-path';
import { getDataPath } from '@util/misc';
import Source, { Line } from './third-party/source';
import { AstEntity, V8Coverage } from './types';

export const logger = LoggerProvider.getLogger('coverage-processor');

type BundleFileData = {
  file: string;
  linesMetadata: Line[];
  hash: string;
  rawSourceMap: RawSourceMap;
};

type ScriptSourceData = {
  urlToHash: Record<string, string>;
  hashToUrl: Record<string, string>;
};

export default async function processCoverage(
  astEntities: AstEntity[],
  bundleData: BundleFileData[],
  targetData: { coverage: V8Coverage; scriptSources: ScriptSourceData; testId: string },
  cache: Record<string, any>,
): Promise<ExecClassData[]> {
  const { testId, coverage: coverageUnfiltered } = targetData;

  if (!coverageUnfiltered || coverageUnfiltered.length === 0) {
    logger.warning('received empty coverage');
    return [];
  }

  // STEP#1 - Filter coverage of irrelevant files by checking hashes
  //  Compares
  //  hashes received _from browser_ (target)
  //  with
  //  hashes provided _by @drill4j/js-parser_
  const bundleMap = arrayToMap('hash')<Record<string, BundleFileData>>(bundleData); // TODO infer return type from data
  const coverageBundle = targetData.coverage
    // filter out script source urls that have no corresponding hashes (e.g. empty urls "")
    .filter(x => !!targetData.scriptSources.urlToHash[x.url]) // TODO make it more readable
    // get the corresponding hashes for passed script sources
    .map(x => ({ ...x, hash: targetData.scriptSources.urlToHash[x.url] }))
    // filter script sources with hashes not matching the expected hashes
    .filter(x => !!bundleMap[targetData.scriptSources.urlToHash[x.url]]);

  if (R.isEmpty(coverageBundle)) {
    logger.warning('all coverage was filtered');
    return [];
  }

  // STEP#2 - Map coverage of raw bundle files to original source files
  const hashes = R.pipe(R.pluck('hash'), R.uniq)(coverageBundle);
  const getMappingFnByHash = await prepareMappingFns(bundleMap, cache)(hashes);
  const obtainMappingFunction = R.pipe(R.prop('hash'), getMappingFnByHash);
  const coverageSourceMapped = R.map(weirdPipe(obtainMappingFunction, transformCoverage))(coverageBundle);

  // STEP#3 - Map source mapped coverage onto Drill4J entity format
  const mapEntityProbes = createProbeMapper(coverageSourceMapped);
  const result = R.pipe(
    R.map((entity: AstEntity) => ({
      id: undefined,
      className: `${normalizeScriptPath(entity.filePath)}${entity.suffix ? `.${entity.suffix}` : ''}`,
      testId,
      probes: mapEntityProbes(entity),
    })),
    R.filter(passProbesNotNull),
  )(astEntities);

  if (result.length === 0) {
    printPathTroubleshootingGuide(coverageSourceMapped, astEntities);
  }

  if (process.env.DEBUG_PROBES_ENABLED === 'true') return writeAndStripDebugInfo(targetData, result, testId);
  return result;
}

const passProbesNotNull = R.pipe(R.prop('probes'), R.complement(R.isNil));

const writeAndStripDebugInfo = async (rawData, data, testId): Promise<ExecClassData[]> => {
  const ts = Date.now();
  const result = stripDebugInfoFromProbes(data);
  const outFolderPath = getDataPath('out', ts.toString(), testId);
  await fsExtra.ensureDir(outFolderPath);
  await fsExtra.writeJSON(`${outFolderPath}/input.json`, rawData, { spaces: 2 });
  await fsExtra.writeJSON(`${outFolderPath}/debug.json`, data, { spaces: 2 });
  await fsExtra.writeJSON(`${outFolderPath}/output.json`, result, { spaces: 2 });
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

// Prepare and cache mapping functions
// 1 bundle file -> 1 sourcemap -> N original files
// building SourceMapConsumer takes a lot of time, hence, the caching
const prepareMappingFns = (bundleFilesHashMap: Record<string, BundleFileData>, cache) => async bundleHashes => {
  await Promise.all(
    R.map(async (hash: string) => {
      if (cache[hash]) return;
      const bundleFile = bundleFilesHashMap[hash];
      // eslint-disable-next-line no-param-reassign
      cache[hash] = new Source(bundleFile.linesMetadata, await new SourceMapConsumer(bundleFile.rawSourceMap));
    })(bundleHashes),
  );

  return hash => ({ startOffset, endOffset, count }) => ({
    ...cache[hash].getOriginalPosition(startOffset, endOffset),
    count,
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
const transformSource = createSourceTransformer(process.env.RECEIVED_PATH_OMIT_PREFIX, process.env.RECEIVED_PATH_APPEND_PREFIX);

const passNotCovered = R.propEq('count', 0);

const passSameLocation = method => functionCoverage =>
  method.location &&
  functionCoverage.location.startLine === method.location.start.line &&
  functionCoverage.location.relStartCol === method.location.start.column;

const allMethodProbesAre =
  process.env.DEBUG_PROBES_ENABLED === 'true'
    ? method => (value: boolean) => () => method.probes.map(probeDebugInfo(value))
    : method => value => () => createArray(method.probes.length)(value);

const createArray = length => value => new Array(length).fill(value);

const probeDebugInfo = isCovered => probe => ({ ...probe, isCovered });

/* HACK-ish implementation (see HACK#1)
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
        R.last, // here is the HACK#1 - pick only innermost's function coverage
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

// DEBUG / UTILITY functions

const arrayToMap = (property: string) => <T>(data: any[]): T =>
  data.reduce((a, x) => {
    // eslint-disable-next-line no-param-reassign
    a[x[property]] = x;
    return a;
  }, {});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const stripDebugInfoFromProbes = R.map(computeProperty('probes')(R.pipe(R.prop('probes'), R.map(R.prop('isCovered')))));

function printPathTroubleshootingGuide(coverageSourceMapped: any[], astEntities: AstEntity[]) {
  logger.warning(
    [
      'MAPPING FAILURE:',
      '_received_ file paths do not match file paths _scanned_ by drill4j/js-parser.\n',

      'Set the following env vars to adjust _received_ path (example):',
      '"RECEIVED_PATH_APPEND_PREFIX": "src/",       - append prefix "src/"',
      '"RECEIVED_PATH_OMIT_PREFIX":   "webpack:///" - remove prefix "webpack:///"\n',

      'Current values:',
      `"RECEIVED_PATH_APPEND_PREFIX": ${process.env.RECEIVED_PATH_APPEND_PREFIX ? process.env.RECEIVED_PATH_APPEND_PREFIX : 'unset'}`,
      `"RECEIVED_PATH_OMIT_PREFIX": ${process.env.RECEIVED_PATH_OMIT_PREFIX ? process.env.RECEIVED_PATH_OMIT_PREFIX : 'unset'}`,
    ].join('\n\t'),
  );

  const msg = getPathsTroubleshootingInfo(coverageSourceMapped, astEntities);

  logger.warning('Printing paths info:', '\n\t', msg);
}

function getPathsTroubleshootingInfo(coverageSourceMapped: any[], astEntities: AstEntity[]) {
  const findMismatches = scriptsCoverage => entity =>
    R.pipe(
      R.flatten,
      R.map(x => entity.filePath.includes(x.location.source) && [{ scanned: entity.filePath, received: x.location.source }]),
    )(scriptsCoverage);

  return R.pipe(
    R.map(findMismatches(coverageSourceMapped)),
    R.flatten,
    R.filter(x => !!x),
    R.map(({ scanned, received }) => `${scanned} - scanned\n\t${received} - received`),
    R.join('\n\n\t'),
  )(astEntities);
}
