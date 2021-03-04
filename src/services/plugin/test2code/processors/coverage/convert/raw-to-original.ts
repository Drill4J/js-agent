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
import { SourceMapConsumer } from 'source-map';
import { OriginalSourceCoverage, RawSourceString, RawSourceCoverage } from '../types';
import Source from './lib/source';

export default function rawToOriginal(
  rawSource: RawSourceString,
  source: Source,
  sourceMapConsumer: SourceMapConsumer,
  ranges: RawSourceCoverage[],
  cache: Record<string, any>,
): OriginalSourceCoverage[] {
  // const source = new Source(rawSource);

  const convertedCoverage = ranges
    .map(range => ({ ...range, rangeString: rawSource.substring(range.startOffset, range.endOffset) }))
    // ignore whitespace-only ranges
    .filter(range => range.rangeString.trim())
    .map(range => {
      // const { rangeString } = range;

      // const leadingWhitespacesCount = rangeString.length - rangeString.trimLeft().length;
      // const trailingWhitespacesCount = rangeString.length - rangeString.trimRight().length;

      // // ignore coverage for whitespaces around range
      // const startOffset = leadingWhitespacesCount > 0 ? range.startOffset + leadingWhitespacesCount : range.startOffset;
      // const endOffset = trailingWhitespacesCount > 0 ? range.endOffset - trailingWhitespacesCount : range.endOffset;
      const { startOffset, endOffset } = range;

      // get position in original source
      let originalPosition;
      if (cache[`${startOffset}/${endOffset}`]) {
        originalPosition = cache[`${startOffset}/${endOffset}`];
      } else {
        originalPosition = source.offsetToOriginalRelative(sourceMapConsumer, startOffset, endOffset);
        // eslint-disable-next-line no-param-reassign
        cache[`${startOffset}/${endOffset}`] = originalPosition;
      }

      const rangeNotInOriginalSource = Object.keys(originalPosition).length === 0;
      if (rangeNotInOriginalSource) {
        return null;
      }

      return {
        ...originalPosition,
        count: range.count,
      };
    })
    // filter ranges not present in the original source files (e.g. bundler generated boilerplate code)
    // filter not-covered ranges
    .filter(range => range && range.count > 0);

  return convertedCoverage;
}
