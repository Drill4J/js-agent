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
import LoggerProvider from '../../../../../util/logger';
import { checkSameBundle, checkScriptNames } from './checks';
import convert from './convert';
import { AstEntity, BundleHashes, BundleScriptNames, ScriptSources, Test, V8Coverage } from './types';
import { printV8Coverage } from './util';

export const logger = LoggerProvider.getLogger('drill', 'coverage-processor');

export default async function processCoverage(
  sourceMapPath: string,
  astEntities: AstEntity[],
  rawData: { coverage: V8Coverage; test: Test; scriptSources: ScriptSources },
  bundleHashes: BundleHashes,
  bundleScriptNames: BundleScriptNames,
): Promise<ExecClassData[]> {
  const {
    coverage,
    test: { name: testName },
    scriptSources: sources,
  } = rawData;

  const v8coverage = coverage
    .filter(scriptCoverage => scriptCoverage.url && sources[scriptCoverage.url])
    .filter(scriptCoverage => checkScriptNames(scriptCoverage, bundleScriptNames))
    .filter(scriptCoverage => checkSameBundle(scriptCoverage.url, sources, bundleHashes));

  if (process.env.DEBUG_TARGET_SCRIPT_URL) {
    printV8Coverage(v8coverage, sources, process.env.DEBUG_TARGET_SCRIPT_URL);
  }
  const execClassesData = await convert(v8coverage, sources, sourceMapPath, astEntities, testName);
  return execClassesData;
}
