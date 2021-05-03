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

import { binarySearchLine } from '../../../../src/services/plugin/test2code/processors/coverage/third-party/source';

it('must return line index when presented with column at the start of the line', () => {
  const lines = [{ line: 1, startCol: 0, endCol: 100, count: 1 }];
  const index = binarySearchLine(lines, 0);
  expect(index).toEqual(0);
});

it('must return line index when presented with column at the end of the line', () => {
  const lines = [{ line: 1, startCol: 0, endCol: 100, count: 1 }];
  const index = binarySearchLine(lines, 100);
  expect(index).toEqual(0);
});

it('must return line index when presented with column anywhere from the line', () => {
  const lines = [{ line: 1, startCol: 0, endCol: 100, count: 1 }];
  const index = binarySearchLine(lines, 38);
  const index2 = binarySearchLine(lines, 50);
  const index3 = binarySearchLine(lines, 72);
  expect(index).toEqual(0);
  expect(index2).toEqual(0);
  expect(index3).toEqual(0);
});

it('must return -1 when presented with column outside of lines range', () => {
  const lines = [{ line: 1, startCol: 0, endCol: 100, count: 1 }];
  const index = binarySearchLine(lines, 999);
  const index2 = binarySearchLine(lines, -999);
  expect(index).toEqual(-1);
  expect(index2).toEqual(-1);
});

it('must return correct line index when presented with column from the respective line', () => {
  const lines = [
    { line: 1, startCol: 0, endCol: 3, count: 1 },
    { line: 2, startCol: 4, endCol: 7, count: 1 },
    { line: 3, startCol: 8, endCol: 11, count: 1 },
  ];
  const linesCols = lines.map(x => {
    const cols = [];
    // eslint-disable-next-line no-plusplus
    for (let i = x.startCol; i <= x.endCol; i++) {
      cols.push(i);
    }
    return cols;
  });
  const indexes = linesCols.map(lineCols => lineCols.map(col => binarySearchLine(lines, col)));
  expect(indexes[0]).toEqual([0, 0, 0, 0]);
  expect(indexes[1]).toEqual([1, 1, 1, 1]);
  expect(indexes[2]).toEqual([2, 2, 2, 2]);
});
