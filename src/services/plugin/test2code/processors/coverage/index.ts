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
import fsExtra from 'fs-extra';
import upath from 'upath';
import convertSourceMap from 'convert-source-map';
import R from 'ramda';
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import LoggerProvider from '../../../../../util/logger';
import Source from './convert/lib/source';
import { AstEntity, BundleHashes, BundleScriptNames, RawSourceString, Test, V8Coverage, V8ScriptCoverage } from './types';

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
    logger.warning('all coverage was filtered');
    return [];
  }

  const scriptsUrls = R.pipe(R.pluck('url'), R.uniq)(scriptsCoverage);

  const getMappingFnByUrl = await prepareMappingFns(sourceMapPath, bundlePath, cache)(urlToHash)(scriptsUrls);

  const transformSource = createSourceTransformer();

  const transformCoverage = rangeMappingFn =>
    R.pipe(
      R.prop('functions'),
      R.map(computeProperty('location')(R.pipe(R.prop('ranges'), R.head, rangeMappingFn, transformSource))),
      R.filter(R.pipe(R.prop('location'), sourceIsNotNil)),
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

  // TODO use groupWith instead?
  const create = coverage => entity =>
    R.pipe(
      R.map(
        R.filter((covPart: any) => {
          return covPart.location.source === entity.filePath;
        }),
      ),
      R.filter((x: any) => x.length > 0),
    )(coverage);

  const mapper = create(fnCoverage);
  const res = R.map(R.pipe(mapper, R.tap(console.log)))(astEntities);

  return [];
}

const computeProperty = name => comp => data => ({
  ...data,
  [name]: comp(data),
});

function omitPrefix(str) {
  return str.replace(process.env.COVERAGE_SOURCE_OMIT_PREFIX, '');
}

function appendPrefix(str) {
  return `${process.env.COVERAGE_SOURCE_APPEND_PREFIX}${str}`;
}

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

  return url => ({ startOffset, endOffset }) => cache[urlToHash[url]].getOriginalPosition(startOffset, endOffset);
};

const sourceIsNotNil = (x: any) => !R.isNil(x?.source);

const sourceIsNotInNodeModules = (x: any) => !x.source.includes('node_modules');

const createSourceTransformer = () => {
  const mustOmitPrefix = !!process.env.COVERAGE_SOURCE_OMIT_PREFIX;
  const mustAppendPrefix = !!process.env.COVERAGE_SOURCE_APPEND_PREFIX;

  if (mustOmitPrefix && mustAppendPrefix) {
    return computeProperty('source')(R.pipe(R.prop('source'), appendPrefix, omitPrefix));
  }

  if (mustAppendPrefix) {
    return computeProperty('source')(R.pipe(R.prop('source'), appendPrefix));
  }

  if (mustOmitPrefix) {
    return computeProperty('source')(R.pipe(R.prop('source'), omitPrefix));
  }

  return R.identity;
};

const createHashFilter = bundleHashes => hashToUrl => {
  const scriptsUrls = bundleHashes.map(x => hashToUrl[x.hash]).filter(x => !!x);
  return url => url && scriptsUrls.includes(url);
};

const getSourceMap = (sourceMapPath: string) => (source: string): RawSourceMap =>
  convertSourceMap.fromMapFileSource(source, sourceMapPath).sourcemap;

const extractScriptName = url => url.substring(url.lastIndexOf('/') + 1) || undefined;

// const scriptNameFilter = R.pipe(R.prop('url'), extractScriptName, createScriptNameFilter(bundleScriptNames));
// const createScriptNameFilter = (scriptNames: string[]) => R.includes(R.__, scriptNames);
