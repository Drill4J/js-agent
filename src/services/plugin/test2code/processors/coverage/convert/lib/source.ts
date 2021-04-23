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
// original implementation https://github.com/istanbuljs/v8-to-istanbul/blob/master/lib/source.js
import { SourceMapConsumer } from 'source-map';
import CovLine from './line';

const { GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND } = SourceMapConsumer;

export default class CovSource {
  lines: CovLine[];

  eof: number;

  sourceMap: SourceMapConsumer;

  mappings: Map<string, any>;

  constructor(sourceRaw: string, sourceMap: SourceMapConsumer) {
    this.lines = [];
    this.eof = sourceRaw.length;
    this._buildLines(sourceRaw);

    this.mappings = new Map();
    this.sourceMap = sourceMap;
  }

  _buildLines(source: string): void {
    let position = 0;
    const raw = source.split(/(?<=\r?\n)/u);
    for (const [i, lineStr] of raw.entries()) {
      const line = new CovLine(i + 1, position, lineStr);
      this.lines.push(line);
      position += lineStr.length;
    }
  }

  offsetOriginalToRelativeNoSourcemap(startCol: number, endCol: number, source) {
    const lineStartIndex = binarySearchLine(this.lines, startCol);
    const lineEndIndex = binarySearchLine(this.lines, endCol);

    if (lineStartIndex === -1 || lineEndIndex === -1) return {};

    const start = this.lines[lineStartIndex];
    const end = this.lines[lineEndIndex];

    return {
      startLine: start.line,
      relStartCol: startCol - start.startCol,
      endLine: end.line,
      relEndCol: endCol - end.startCol,
      source,
    };
  }

  getOriginalPosition(startCol: number, endCol: number) {
    const key = `${startCol}/${endCol}`;
    if (this.mappings.has(key)) {
      return this.mappings.get(key);
    }
    const mapping = this._offsetToOriginalRelative(startCol, endCol);
    this.mappings.set(key, mapping);
    return mapping;
  }

  // given a start column and end column in absolute offsets within
  // a source file (0 - EOF), returns the relative line column positions.
  _offsetToOriginalRelative(startCol: number, endCol: number) {
    const lineStartIndex = binarySearchLine(this.lines, startCol);
    const lineEndIndex = binarySearchLine(this.lines, endCol);

    if (lineStartIndex === -1 || lineEndIndex === -1) return {};

    const lines = this.lines.slice(lineStartIndex, lineEndIndex + 1); // TODO remove unnecessary slice (only 0 and last elements are used)

    if (!lines.length) return {};

    const start = this.originalPositionTryBoth(lines[0].line, Math.max(0, startCol - lines[0].startCol));

    const lastLine = lines[lines.length - 1];
    let end = this.originalEndPositionFor(lastLine.line, endCol - lastLine.startCol);

    if (!(start && end)) {
      return {};
    }

    if (!(start.source && end.source)) {
      return {};
    }

    if (start.source !== end.source) {
      return {};
    }

    if (start.line === end.line && start.column === end.column) {
      end = this.sourceMap.originalPositionFor({
        line: lastLine.line,
        column: endCol - lastLine.startCol,
        bias: LEAST_UPPER_BOUND,
      });
      end.column -= 1;
    }

    return {
      startLine: start.line,
      relStartCol: start.column,
      endLine: end.line,
      relEndCol: end.column,
      source: end.source,
    };
  }

  // this implementation is pulled over from istanbul-lib-sourcemap:
  // https://github.com/istanbuljs/istanbuljs/blob/master/packages/istanbul-lib-source-maps/lib/get-mapping.js
  //
  /**
   * AST ranges are inclusive for start positions and exclusive for end positions.
   * Source maps are also logically ranges over text, though interacting with
   * them is generally achieved by working with explicit positions.
   *
   * When finding the _end_ location of an AST item, the range behavior is
   * important because what we're asking for is the _end_ of whatever range
   * corresponds to the end location we seek.
   *
   * This boils down to the following steps, conceptually, though the source-map
   * library doesn't expose primitives to do this nicely:
   *
   * 1. Find the range on the generated file that ends at, or exclusively
   *    contains the end position of the AST node.
   * 2. Find the range on the original file that corresponds to
   *    that generated range.
   * 3. Find the _end_ location of that original range.
   */
  originalEndPositionFor(line, column) {
    // Given the generated location, find the original location of the mapping
    // that corresponds to a range on the generated file that overlaps the
    // generated file end location. Note however that this position on its
    // own is not useful because it is the position of the _start_ of the range
    // on the original file, and we want the _end_ of the range.
    const beforeEndMapping = this.originalPositionTryBoth(line, Math.max(column, 1));

    if (beforeEndMapping.source === null) {
      return null;
    }

    // Convert that original position back to a generated one, with a bump
    // to the right, and a rightward bias. Since 'generatedPositionFor' searches
    // for mappings in the original-order sorted list, this will find the
    // mapping that corresponds to the one immediately after the
    // beforeEndMapping mapping.
    const afterEndMapping = this.sourceMap.generatedPositionFor({
      // TODO this runs very slow. Why?
      source: beforeEndMapping.source,
      line: beforeEndMapping.line,
      column: beforeEndMapping.column + 1,
      bias: LEAST_UPPER_BOUND,
    });

    if (afterEndMapping.line === null) {
      // If this is null, it means that we've hit the end of the file,
      // so we can use Infinity as the end column.
      return {
        source: beforeEndMapping.source,
        line: beforeEndMapping.line,
        column: Infinity,
      };
    }
    return beforeEndMapping;

    // // Convert the end mapping into the real original position.
    // const originalPosForAfterEndMapping = this.sourceMap.originalPositionFor(afterEndMapping);

    // if (originalPosForAfterEndMapping.line !== beforeEndMapping.line) {
    //   // If these don't match, it means that the call to
    //   // 'generatedPositionFor' didn't find any other original mappings on
    //   // the line we gave, so consider the binding to extend to infinity.
    //   return {
    //     source: beforeEndMapping.source,
    //     line: beforeEndMapping.line,
    //     column: Infinity,
    //   };
    // }

    // return originalPosForAfterEndMapping;
  }

  originalPositionTryBoth(line, column) {
    const original = this.sourceMap.originalPositionFor({
      line,
      column,
      bias: GREATEST_LOWER_BOUND,
    });
    if (original.line === null) {
      return this.sourceMap.originalPositionFor({
        line,
        column,
        bias: LEAST_UPPER_BOUND,
      });
    }
    return original;
  }
}

// TODO think of an other way to expose functions for testing
// strip-code plugins mess up source maps and break TS debugging
export function binarySearchLine(lines: CovLine[], col: number): number {
  let start = 0;
  let end = lines.length - 1;

  while (start <= end) {
    const mid = Math.floor((start + end) / 2);

    if (lines[mid].startCol <= col && lines[mid].endCol >= col) return mid;

    if (lines[mid].endCol < col) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return -1;
}
