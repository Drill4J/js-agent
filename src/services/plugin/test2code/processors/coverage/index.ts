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
import R from 'ramda';
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import LoggerProvider from '@util/logger';
import normalizeScriptPath from '@util/normalize-script-path';
import { getDataPath } from '@util/misc';
import Source, { Line } from './source';
import { AstEntity, V8ScriptCoverageData, V8ScriptParsedEventData } from './types';

export const logger = LoggerProvider.getLogger('coverage-processor');

type BundleFileData = {
  file: string;
  linesMetadata: Line[];
  hash: string;
  rawSourceMap: RawSourceMap;
};

// Map V8 coverage -> source coverage -> Drill4J entities (packages/classes/methods table)
export default async function processCoverage(
  astEntities: AstEntity[],
  bundleData: BundleFileData[],
  targetData: { coverage: V8ScriptCoverageData; scripts: V8ScriptParsedEventData[]; testId: string },
  cache: Record<string, any>,
): Promise<ExecClassData[]> {
  const { testId } = targetData;

  const scripts: V8ScriptParsedEventData[] = JSON.parse(targetData.scripts as any);
  const targetDataCoverage: V8ScriptCoverageData = JSON.parse(targetData.coverage as any);

  if (!Array.isArray(targetDataCoverage?.result) || targetDataCoverage.result.length === 0) {
    logger.warning('received empty coverage');
    return [];
  }

  // STEP#1 - Filter coverage of irrelevant files
  const scriptUrlToHash = createPropToPropMap<string>('url', 'hash')(scripts);
  const bundleMap = createPropToEntryMap<BundleFileData>('hash')(bundleData);

  const coverage = targetDataCoverage.result
    // .filter(x => !!x.url) // filter scripts with empty urls
    .filter(x => !!scriptUrlToHash[x.url]) // filter scripts with no corresponding hashes
    .map(x => ({ ...x, hash: scriptUrlToHash[x.url] })) // mark coverage entries with the respective script hash
    .filter(x => !!bundleMap[scriptUrlToHash[x.url]]); // filter script sources with hashes not matching the expected hashes

  if (R.isEmpty(coverage)) {
    logger.warning('all coverage was filtered');
    return [];
  }

  // STEP#2 - Map to original source files
  const hashes = R.pipe(R.pluck('hash'), R.uniq)(coverage);
  const getMappingFnByHash = await prepareMappingFns(bundleMap, cache)(hashes);
  const obtainMappingFunction = R.pipe(R.prop('hash'), getMappingFnByHash);
  const sourceCoverage = R.map(weirdPipe(obtainMappingFunction, transformCoverage))(coverage);
  // STEP#3 - Map to Drill4J entity format
  const mapEntityProbes = createProbeMapper(sourceCoverage);
  const d4jCoverage = R.pipe(
    R.map((entity: AstEntity) => ({
      id: undefined,
      className: `${normalizeScriptPath(entity.filePath)}${entity.suffix ? `.${entity.suffix}` : ''}`,
      testId,
      probes: mapEntityProbes(entity),
    })),
    R.filter(passProbesNotNull),
  )(astEntities);

  // If there was relevant coverage, but after mapping there is none
  // there _must_ be a mapping issue
  if (d4jCoverage.length === 0) {
    printPathTroubleshootingGuide(sourceCoverage, astEntities);
  }

  if (process.env.DEBUG_PROBES_ENABLED === 'true') return writeAndStripDebugInfo(targetData, d4jCoverage, testId);
  return d4jCoverage;
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

const weirdPipe = (fn1, fn2) => data => fn2(fn1(data))(data);

const transformCoverage = (sourceData: Source) =>
  R.pipe(
    R.prop('functions'),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    R.filter((x: any) => x.isBlockCoverage),

    // find original file and position of corresponding function
    R.map(
      computeProperty('location')(
        R.pipe(R.prop('ranges'), R.head, ({ startOffset, count }) => {
          const originalPosition = sourceData.mapToOriginalPosition(startOffset);
          if (!originalPosition) return null;
          const { line, column, source } = originalPosition;
          return {
            source,
            line,
            column,
            count,
          };
        }),
      ),
    ),

    // filter functions from irrelevant files (node_modules, /webpack/ boilerplate, etc)
    R.filter(R.pipe(R.path(['location', 'source']), R.allPass([isNotNil, notIncludes(process.env.IGNORE_SOURCES.split(', '))]))),

    // adjust file source path
    R.map(computeProperty('location')(R.pipe(R.prop('location'), transformSource))),

    // convert ranges from absolute columns (aka offsets) to line:column (though still in the _bundle_ positions)
    R.map(
      computeProperty('ranges')(
        R.pipe(
          R.prop('ranges'),
          R.map(({ startOffset, endOffset, count }) => ({
            start: sourceData.convertToLineColumn(startOffset),
            end: sourceData.convertToLineColumn(endOffset),
            count,
          })),
        ),
      ),
    ),
  );

const createProbeMapper = scriptsCoverage => entity =>
  R.pipe(
    // TODO use key-value - scriptsCoverage by source (to avoid mapping/filtering multiple times)
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
      cache[hash] = new Source(bundleFile.linesMetadata, await new SourceMapConsumer(bundleFile.rawSourceMap), logger);
    })(bundleHashes),
  );
  return hash => cache[hash];
};

const isNotNil = (x: unknown) => !R.isNil(x);

const passNotEmpty = R.complement(R.isEmpty);

const notIncludes = (ignore: string[]) => (x: any) => !ignore.some(src => x.includes(src));

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
  functionCoverage.location.line === method.location.start.line && functionCoverage.location.column === method.location.start.column;

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
      - have 100% coverage (if innermost function is called at least once)
    
    That collides with the probes placed in the original code (because of the same location)

    The solution: map coverage only from the innermost function
*/
const mapCoverageToMethod = entityCoverage => method =>
  R.pipe(
    R.tap((x: any) => {
      console.log(x.length);
    }),
    // TODO optimize - use key-value - coverage by location (to avoid excessive mapping/filtering)
    // mark not-used coverage parts (values) (will happen due to location mismatch)
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

const isProbeCovered = notCoveredRanges => probe =>
  notCoveredRanges.findIndex(range => areMappingsInsideRange(probe.mappings, range)) === -1;

function areMappingsInsideRange(mappings, range) {
  return mappings.some(m => {
    const isMappingLineInsideRange = m.generatedLine >= range.start.line && m.generatedLine <= range.end.line;
    if (!isMappingLineInsideRange) return false;

    const isSingleLineRange = range.start.line === range.end.line;
    if (isSingleLineRange) {
      return m.generatedColumn >= range.start.column && m.generatedColumn <= range.end.column;
    }
    if (m.generatedLine === range.start.line) {
      return m.generatedColumn >= range.start.column;
    }
    if (m.generatedLine === range.end.line) {
      return m.generatedColumn <= range.end.column;
    }
    // mapping is inside range - line is in between range start & end lines
    // column is irrelevant
    return true;
  });
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

const createPropToEntryMap = <T>(property: string) => (entries: T[]): Record<string, T> =>
  entries.reduce((a, x) => {
    // eslint-disable-next-line no-param-reassign
    a[x[property]] = x;
    return a;
  }, {});

const createPropToPropMap = <T>(keyProp, valueProp) => (arr): Record<string, T> =>
  arr.reduce((a, x) => {
    // eslint-disable-next-line no-param-reassign
    a[x[keyProp]] = x[valueProp];
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
