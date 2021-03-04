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
// original implementation https://github.com/istanbuljs/v8-to-istanbul/blob/master/lib/line.js
export default class CovLine {
  line: number;

  startCol: number;

  endCol: number;

  // count: number;

  constructor(line: number, startCol: number, lineStr: string) {
    this.line = line;
    // note that startCol and endCol are absolute positions
    // within a file, not relative to the line.
    this.startCol = startCol;

    // const matchedNewLineChar = lineStr.match(/\r?\n$/u);
    // const newLineLength = matchedNewLineChar ? matchedNewLineChar[0].length : 0;

    this.endCol = startCol + lineStr.length - 1; // -1 because columns are zero-based // - newLineLength;
  }
}
