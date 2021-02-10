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
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import LoggerProvider from '../../../../../../util/logger';
import { AstEntity, RawSourceString, ScriptName, V8ScriptCoverage } from '../types';
import { extractScriptNameFromUrl } from '../util';
import originalToExecClass from './original-to-exec-class';
import rawToOriginal from './raw-to-original';
import v8ToRaw from './v8-to-raw';

const logger = LoggerProvider.getLogger('drill', 'coverage-processor');

// FIXME convert is synchronous without sourcemapConsumer creation
export default async function convert(
  v8coverage: V8ScriptCoverage[],
  sourceMapPath: string,
  astEntities: AstEntity[],
  testName: string,
  cache: Record<string, any>,
): Promise<ExecClassData[]> {
  const originalSourceCoverage1 = [];
  for (const v8ScriptCoverage of v8coverage) {
    const id1 = global.prf.mark('coverage-part');

    const { url, functions, source, scriptId, sourceHash } = v8ScriptCoverage;

    const id2 = global.prf.mark('coverage-part|v8-to-raw');
    const bundleRanges = v8ToRaw(functions);
    global.prf.measure(id2);

    const scriptName = extractScriptNameFromUrl(url);

    const id3 = global.prf.mark('coverage-part|cached');
    // FIXME - move cache preparation outside of convert
    if (!cache[sourceHash]) {
      const sourceMap = getSourceMap(source, scriptName, sourceMapPath);
      // eslint-disable-next-line no-param-reassign
      cache[sourceHash] = {
        mappings: {},
        sourceMapConsumer: await new SourceMapConsumer(sourceMap),
      };
    }
    global.prf.measure(id3);

    const id4 = global.prf.mark('coverage-part|raw-to-original');
    const res = rawToOriginal(source, cache[sourceHash].sourceMapConsumer, bundleRanges, cache[sourceHash].mappings);
    global.prf.measure(id4);

    originalSourceCoverage1.push(res);

    global.prf.measure(id1);
  }

  const pathTransformMark = global.prf.mark('path-transform');
  // TODO acc and currentValue are swapped
  const originalSourceCoverage2 = originalSourceCoverage1.reduce((ranges, acc) => acc.concat(...ranges), []);
  const originalSourceCoverage = originalSourceCoverage2.filter(x => x.source && !x.source.includes('node_modules'));

  let transformed = originalSourceCoverage;
  if (process.env.COVERAGE_SOURCE_OMIT_PREFIX) {
    transformed = transformed.map(x => ({ ...x, source: x.source.replace(process.env.COVERAGE_SOURCE_OMIT_PREFIX, '') }));
  }
  if (process.env.COVERAGE_SOURCE_APPEND_PREFIX) {
    transformed = transformed.map(x => ({ ...x, source: `${process.env.COVERAGE_SOURCE_APPEND_PREFIX}${x.source}` }));
  }
  global.prf.measure(pathTransformMark);

  const toExecClassMark = global.prf.mark('transform-to-exec-class');
  const execClassData = astEntities.map(x => originalToExecClass(transformed, x, testName));
  const filteredExecClass = execClassData.filter(x => x && x.probes.includes(true));
  global.prf.measure(toExecClassMark);
  return filteredExecClass;
}

function getSourceMap(source: RawSourceString, scriptName: ScriptName, sourceMapPath: string): RawSourceMap {
  const sourceMap = convertSourceMap.fromMapFileSource(source, sourceMapPath);
  const sourceMapExists = sourceMap?.sourcemap?.file?.includes(scriptName);
  if (!sourceMapExists) {
    logger.warning(`there is no source map for ${scriptName}`);
  }
  return sourceMap.sourcemap;
}
