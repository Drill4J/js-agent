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
import convertSourceMap from 'convert-source-map';
import { RawSourceMap } from 'source-map';
import LoggerProvider from '../../../../../../util/logger';
import { AstEntity, RawSource, ScriptName, TestName, V8ScriptCoverage } from '../types';
import { extractScriptNameFromUrl } from '../util';
import originalToExecClass from './original-to-exec-class';
import rawToOriginal from './raw-to-original';
import v8ToRaw from './v8-to-raw';

const logger = LoggerProvider.getLogger('drill', 'coverage-processor');

export default async function convert(
  v8coverage: V8ScriptCoverage[],
  sourceMapPath: string,
  astEntities: AstEntity[],
  testName: string,
): Promise<ExecClassData[]> {
  const originalSourceCoverage = (
    await Promise.all(
      v8coverage.map(async v8ScriptCoverage => {
        const { url, functions, source } = v8ScriptCoverage;
        const bundleRanges = v8ToRaw(functions);
        const scriptName = extractScriptNameFromUrl(url);

        // TODO keeping sourcemap in memory can save ~300ms on each run, idk if it's worth it
        const sourceMap = getSourceMap(source, scriptName, sourceMapPath);

        const res = await rawToOriginal(source, sourceMap, bundleRanges);
        return res;
      }),
    )
  )
    .reduce((ranges, acc) => acc.concat(...ranges), []) // TODO acc and currentValue are swapped
    .filter(x => x.source && !x.source.includes('node_modules'));

  // TODO refactor let?
  let transformed = originalSourceCoverage;
  if (process.env.COVERAGE_SOURCE_OMIT_PREFIX) {
    transformed = transformed.map(x => ({ ...x, source: x.source.replace(process.env.COVERAGE_SOURCE_OMIT_PREFIX, '') }));
  }
  if (process.env.COVERAGE_SOURCE_APPEND_PREFIX) {
    transformed = transformed.map(x => ({ ...x, source: `${process.env.COVERAGE_SOURCE_APPEND_PREFIX}${x.source}` }));
  }

  const execClassData = astEntities.map(x => originalToExecClass(transformed, x, testName));
  return execClassData.filter(x => x && x.probes.includes(true));
}

function getSourceMap(source: RawSource, scriptName: ScriptName, sourceMapPath: string): RawSourceMap {
  const sourceMap = convertSourceMap.fromMapFileSource(source, sourceMapPath);
  const sourceMapExists = sourceMap?.sourcemap?.file?.includes(scriptName);
  if (!sourceMapExists) {
    logger.warning(`there is no source map for ${scriptName}`);
  }
  return sourceMap.sourcemap;
}
