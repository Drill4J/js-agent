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
import { RawSource, ScriptName, V8Coverage, V8FunctionCoverage } from './types';

export function extractScriptNameFromUrl(url: string): ScriptName {
  return url.substring(url.lastIndexOf('/') + 1) as ScriptName;
}

export function printV8Coverage(v8coverage: V8Coverage, targetUrl: string): void {
  v8coverage.forEach(part => {
    const { url, functions, source } = part;
    if (url === targetUrl) {
      printRangeCoverage(source, functions);
    }
  });
}

function printRangeCoverage(rawSource: RawSource, v8coverage: V8FunctionCoverage[]): void {
  const omissionCharacter = '\u200B';

  const highlightedSource = v8coverage.reduce((acc, fn) => {
    const toAppend = fn.ranges.reduce((acc2, range) => {
      let textToAppend;
      const originalText = rawSource.substring(range.startOffset, range.endOffset);
      if (range.count === 0) {
        textToAppend = omissionCharacter;
      } else if (range.count === 1) {
        textToAppend = chalk.bgGreen.black(originalText);
      } else if (range.count === 2) {
        textToAppend = chalk.bgBlue.black(originalText);
      } else if (range.count > 2) {
        textToAppend = chalk.bgYellow.black(originalText);
      }
      return acc2 + textToAppend;
    }, '');
    return acc + toAppend;
  }, '');

  const highlightedLines = highlightedSource
    .replace(new RegExp(`${omissionCharacter}+`, 'g'), '\n...not covered lines...\n')
    .replace(/\r?\n/g, '\n')
    .split('\n');
  highlightedLines.forEach(x => console.log(x));
}
