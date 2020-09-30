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
import { RawSourceMap, SourceMapConsumer } from 'source-map';
import { OriginalSourceCoverage, RawSource, RawSourceCoverage } from '../types';
import Source from './lib/source';

export default async function rawToOriginal(
  rawSource: RawSource,
  sourceMap: RawSourceMap,
  ranges: RawSourceCoverage[],
): Promise<OriginalSourceCoverage[]> {
  const source = new Source(rawSource, null);
  const sourceMapConsumer = await new SourceMapConsumer(sourceMap);
  const convertedCoverage = ranges
    .map(range => {
      const rangeString = rawSource.substring(range.startOffset, range.endOffset);
      if (!rangeString.trim()) return null; // ignore range if it contains only whitespaces, tabs and newlines

      const leadingWhitespacesCount = rangeString.length - rangeString.trimLeft().length;
      const trailingWhitespacesCount = rangeString.length - rangeString.trimRight().length;

      // ignore whitespace coverage
      const startOffset = leadingWhitespacesCount > 0 ? range.startOffset + leadingWhitespacesCount : range.startOffset;
      const endOffset = trailingWhitespacesCount > 0 ? range.endOffset - trailingWhitespacesCount : range.endOffset;

      const originalPosition = source.offsetToOriginalRelative(sourceMapConsumer, startOffset, endOffset);
      const rangeNotInOriginalSource = Object.keys(originalPosition).length === 0;
      if (rangeNotInOriginalSource) return null;
      return {
        ...originalPosition,
        count: range.count,
      };
    })
    // filter ranges not present in the original source files
    // e.g. ranges corresponding to boilerplate code produced at file concatenation phase in the build pipeline
    // filter not-covered ranges
    .filter(range => range && range.count > 0);
  sourceMapConsumer.destroy();
  return convertedCoverage;
}
