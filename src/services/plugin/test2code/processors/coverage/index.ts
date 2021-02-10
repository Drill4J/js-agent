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
import * as upath from 'upath';
import fsExtra from 'fs-extra';
import chalk from 'chalk';
import LoggerProvider from '../../../../../util/logger';
import { checkScriptNames } from './checks';
import convert from './convert';
import { AstEntity, BundleHashes, BundleScriptNames, RawSourceString, ScriptSources, Test, V8Coverage } from './types';
import { extractScriptNameFromUrl } from './util';

export const logger = LoggerProvider.getLogger('drill', 'coverage-processor');

export default async function processCoverage(
  sourceMapPath: string,
  astEntities: AstEntity[],
  rawData: { coverage: V8Coverage; scriptSources: ScriptSources; testName: string },
  bundlePath: string,
  bundleHashes: BundleHashes,
  bundleScriptNames: BundleScriptNames,
  cache: Record<string, any>,
): Promise<ExecClassData[]> {
  const initialFilterMark = global.prf.mark('initial-filter');
  const {
    coverage,
    scriptSources: { hashToUrl, urlToHash },
  } = rawData;
  const { testName } = rawData;

  if (!coverage || coverage.length === 0) {
    logger.warning('received empty coverage');
    return [];
  }

  const coverageUrls = bundleHashes.map(x => hashToUrl[x.hash]).filter(x => !!x);

  // FIXME move sourceMapConsumer & Source class "preparation" & caching here
  const v8coverage = (
    await Promise.all(
      coverage
        .filter(scriptCoverage => scriptCoverage.url && coverageUrls.includes(scriptCoverage.url as any))
        .map(async x => ({
          ...x,
          source: await getScriptSource(bundlePath, x.url),
          sourceHash: urlToHash[x.url],
        })),
    )
  )
    .filter(x => x.source)
    .filter(scriptCoverage => checkScriptNames(scriptCoverage, bundleScriptNames));

  if (v8coverage.length === 0) {
    logger.warning('all coverage was filtered');
    return [];
  }
  global.prf.measure(initialFilterMark);

  const convertMark = global.prf.mark('convert');
  const execClassesData = await convert(v8coverage, sourceMapPath, astEntities, testName, cache);
  global.prf.measure(convertMark);
  return execClassesData;
}

async function getScriptSource(bundlePath, url): Promise<RawSourceString | null> {
  try {
    const scriptName = extractScriptNameFromUrl(url);
    const source = (await fsExtra.readFile(upath.join(bundlePath, scriptName))).toString('utf8');
    if (!source) {
      logger.warning(`unknown script: ${url}`);
    }
    return source as RawSourceString;
  } catch (e) {
    logger.warning(`failed to obtain source of script: ${url}`);
    return null;
  }
}
