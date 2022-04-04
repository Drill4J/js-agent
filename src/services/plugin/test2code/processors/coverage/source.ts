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
import { MappingItem, NullableMappedPosition, SourceMapConsumer } from 'source-map';

const { GREATEST_LOWER_BOUND } = SourceMapConsumer;

export type Line = {
  index: number;
  startCol: number;
  endCol: number;
};

export default class Source {
  lines: Line[];

  sourceMap: SourceMapConsumer;

  mappings: Map<string, NullableMappedPosition>;

  mappingsBySource: Map<string, MappingItem[]>;

  constructor(lines: Line[], sourceMap: SourceMapConsumer) {
    this.lines = lines;
    this.mappings = new Map();
    this.mappingsBySource = new Map();
    this.sourceMap = sourceMap;
  }

  public mapToOriginalPosition(column: number): NullableMappedPosition {
    const key = `${column}`;
    if (this.mappings.has(key)) return this.mappings.get(key);

    const mapping = this._mapToOriginalPosition(column);
    this.mappings.set(key, mapping);
    return mapping;
  }

  public getMappings(originalSource: string, line: number, column: number): MappingItem[] {
    const key = `${originalSource}:${line}:${column}`;
    if (this.mappingsBySource.has(key)) {
      return this.mappingsBySource.get(key);
    }

    const mappings: MappingItem[] = [];
    this.sourceMap.eachMapping(x => {
      if (x.source === originalSource && x.originalLine === line && x.originalColumn === column) mappings.push(x);
    });
    this.mappingsBySource.set(key, mappings);
    return mappings;
  }

  public convertToLineColumn(column: number): { line: number; column: number } {
    const line = this.findLine(column);
    const columnIndex = column - line.startCol;
    return {
      line: line.index,
      column: columnIndex,
    };
  }

  /*
    Maps _bundle column_ to the _line:column in the original_ file
    If there is no mapping for the passed _bundle column_
    then return value is null
  */
  private _mapToOriginalPosition(column: number): NullableMappedPosition | null {
    // determine bundle line index
    const line = this.findLine(column);
    if (!line) return null;

    // get original position
    const original = this.sourceMap.originalPositionFor({
      line: line.index,
      column: Math.max(0, column - line.startCol),
      bias: GREATEST_LOWER_BOUND, // bias is not important, since we're looking for the _exact_ match
    });
    if (original.line === null || original.column === null || original.source === null) return null;

    /*
      validate that mapping was the _exact_ match
      source-map library (and the underlying WASM module) does not allow for non-biased query
      thus, the "backmap" check is perfromed (bundle pos -> original pos -> the same bundle pos)
      */
    // TODO check perf costs
    const generatedPositions = this.sourceMap.allGeneratedPositionsFor(original);
    const backmappedLines = generatedPositions.map(generated => this.lines.find(x => x.index === generated.line)).filter(x => x);

    if (
      !generatedPositions.some(generated => backmappedLines.some(backmappedLine => generated.column + backmappedLine.startCol === column))
    ) {
      console.log(
        'Mapping: no exact match',
        '\n',
        'bundle column',
        '\t\t',
        column,
        '\n',
        'mapped pos',
        '\t\t',
        JSON.stringify(original),
        '\n',
        'backmapped pos',
        '\t\t',
        JSON.stringify(generatedPositions),
      );
      console.log('\n');
      return null;
    }

    return original;
  }

  private findLine(col: number): Line | null {
    let start = 0;
    let end = this.lines.length - 1;

    while (start <= end) {
      const mid = Math.floor((start + end) / 2);

      if (this.lines[mid].startCol <= col && this.lines[mid].endCol >= col) return this.lines[mid];

      if (this.lines[mid].endCol < col) {
        start = mid + 1;
      } else {
        end = mid - 1;
      }
    }

    return null;
  }
}
