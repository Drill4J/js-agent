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
import chalk from 'chalk';
import { RawSource, ScriptName, ScriptSources, V8Coverage, V8FunctionCoverage } from './types';

export function extractScriptNameFromUrl(url: string): ScriptName {
  return url.substring(url.lastIndexOf('/') + 1) as ScriptName;
}

export function printV8Coverage(v8coverage: V8Coverage, sources: ScriptSources, targetUrl: string): void {
  v8coverage.forEach(part => {
    const { url, functions } = part;
    const script = sources[url];
    if (url === targetUrl) {
      printRangeCoverage(script.source, functions);
    }
  });
}

function printRangeCoverage(rawSource: RawSource, v8coverage: V8FunctionCoverage[]): void {
  const raw = rawSource;
  let highlightedSource = '';
  /* eslint-disable no-plusplus */
  for (let offset = 0; offset < raw.length; offset++) {
    const symbol = raw[offset];
    let toAppend = symbol;
    v8coverage.forEach(fn => {
      fn.ranges
        .filter(range => range.startOffset <= offset && range.endOffset >= offset)
        .forEach(range => {
          if (range.count === 0) {
            toAppend = chalk.bgRed.black(symbol);
          } else if (range.count === 1) {
            toAppend = chalk.bgGreen.black(symbol);
          } else if (range.count === 2) {
            toAppend = chalk.bgBlue.black(symbol);
          } else if (range.count > 2) {
            toAppend = chalk.bgYellow.black(symbol);
          }
        });
    });

    highlightedSource += toAppend;
  }
  const highlightedLines = highlightedSource.replace(/\r?\n/g, '\n').split('\n');
  highlightedLines.forEach(x => console.log(x));
}
