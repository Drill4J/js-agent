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
import R, { andThen } from 'ramda';
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import chalk from 'chalk';
import LoggerProvider from '../../../../../util/logger';
import { checkScriptNames } from './checks';
import convert from './convert';
import Source from './convert/lib/source';
import { AstEntity, BundleHashes, BundleScriptNames, RawSourceString, Test, V8Coverage, V8ScriptCoverage } from './types';
import { extractScriptNameFromUrl } from './util';

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

  const scriptCovs = R.filter(hashFilter)(coverage);
  if (R.isEmpty(scriptCovs)) {
    logger.warning('all coverage was filtered');
    return [];
  }

  const createMappingFn = prepMappingFn(sourceMapPath, bundlePath, cache, urlToHash);
  const transformSource = createSourceTransformer();

  // R.tap((...x) => {
  //   console.log(x);
  // }),

  const c2 = await Promise.all(
    R.map(async (script: V8ScriptCoverage) => {
      const mappingFn = await createMappingFn(script.url);
      return R.map(
        R.pipe(
          R.prop('functions'),
          R.map(computeProperty('location')(R.pipe(R.prop('ranges'), R.head, mappingFn, transformSource))),
          R.filter(R.pipe(R.prop('location'), sourceIsNotNil)),
          R.map(
            computeProperty('ranges')(
              R.pipe(
                R.prop('ranges'),
                R.map(mappingFn),
                R.filter(R.allPass([sourceIsNotNil, sourceIsNotInNodeModules])),
                R.map(transformSource),
              ),
            ),
          ),
        ),
      )(scriptCovs); // TODO :( do not pass data twice
    })(scriptCovs),
  );

  return [];
}

const computeProperty = name => comp => data => {
  return {
    ...data,
    [name]: comp(data),
  };
};

const sourceIsNotNil = (x: any) => !R.isNil(x?.source);

const sourceIsNotInNodeModules = (x: any) => !x.source.includes('node_modules');

const stringIncludes = str => search => str.includes(search);

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

const createSourceTransformer = () => {
  const ap = (x: any) => ({ ...x, source: appendPrefix(x.source) });
  const op = (x: any) => ({ ...x, source: omitPrefix(x.source) });

  if (isPrefixOmissionEnabled() && isPrefixAppendageEnabled()) {
    return R.pipe(ap, op);
  }

  if (isPrefixAppendageEnabled()) {
    return ap;
  }

  if (isPrefixOmissionEnabled()) {
    return op;
  }

  return R.identity;
};

const createHashFilter = bundleHashes => hashToUrl => {
  const coverageUrls = bundleHashes.map(x => hashToUrl[x.hash]).filter(x => !!x);
  return scriptCoverageUrl => scriptCoverageUrl && coverageUrls.includes(scriptCoverageUrl);
};

const prepMappingFn = (sourceMapPath, bundlePath, cache, urlToHash) => async url => {
  const mapper = await getSourceMapper(sourceMapPath, bundlePath, cache, urlToHash)(url);
  return ({ startOffset, endOffset }) => mapper.getOriginalPosition(startOffset, endOffset);
};

const getSourceMapper = (sourceMapPath, bundlePath, cache, urlToHashObj) => async (url): Promise<Source> => {
  const sourceHash = urlToHashObj[url];
  if (cache[sourceHash]) return cache[sourceHash];

  const scriptName = extractScriptName(url);
  const buf = await fsExtra.readFile(upath.join(bundlePath, scriptName));
  const rawSource = buf.toString('utf8');
  // eslint-disable-next-line no-param-reassign
  cache[sourceHash] = new Source(rawSource, await new SourceMapConsumer(getSourceMap(sourceMapPath)(rawSource)));
  // TODO
  // const sourceMapExists = sourceMap?.sourcemap?.file?.includes(scriptName);
  // if (!sourceMapExists) {
  //   logger.warning(`there is no source map for ${scriptName}`);
  // }
  return cache[sourceHash];
};

const getSourceMap = (sourceMapPath: string) => (source: string): RawSourceMap =>
  convertSourceMap.fromMapFileSource(source, sourceMapPath).sourcemap;

const extractScriptName = url => url.substring(url.lastIndexOf('/') + 1) || undefined;

// const scriptNameFilter = R.pipe(R.prop('url'), extractScriptName, createScriptNameFilter(bundleScriptNames));
// const createScriptNameFilter = (scriptNames: string[]) => R.includes(R.__, scriptNames);
