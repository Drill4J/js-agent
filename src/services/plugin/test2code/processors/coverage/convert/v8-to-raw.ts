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
import { RawSourceCoverage, V8FunctionCoverage } from '../types';

/*
 *  For a reference see https://v8.dev/blog/javascript-code-coverage#for-embedders
 *
 *  Pay attention to exact range positions in function objects.
 *  For each function:
 *  - ranges with index > 0 overlap Range 0;
 *  - essentially Range 0 is a "base" that marks the whole function as "covered";
 *  - and all ranges with index > 0 exclude certain parts from Range 0, marking those as "not-covered".
 *
 *  Ranges are converted for the whole script at once because some functions have overlapping ranges. (e.g. nested functions, callbacks)
 */
export default function v8ToRaw(functions: V8FunctionCoverage[]): RawSourceCoverage[] {
  return functions.reduce((acc, fn) => {
    return fn.ranges.reduce((acc2, range) => {
      return mergeRange(acc2, range);
    }, acc);
  }, <RawSourceCoverage[]>[]);
}

function mergeRange(successiveRanges: RawSourceCoverage[], newRange: RawSourceCoverage): RawSourceCoverage[] {
  const rangesToInsert: RawSourceCoverage[] = [newRange];
  if (successiveRanges.length === 0) {
    return rangesToInsert;
  }

  const intersectionIndex = successiveRanges.findIndex(
    range => range.startOffset <= newRange.startOffset && range.endOffset >= newRange.endOffset,
  );

  if (intersectionIndex === -1) {
    const rightNeighboringRange = successiveRanges.findIndex(range => range.startOffset >= newRange.endOffset) > -1;
    if (rightNeighboringRange) {
      return [newRange, ...successiveRanges];
    }
    return [...successiveRanges, newRange];
  }

  const intersectedRange = successiveRanges[intersectionIndex];

  const touchStart = intersectedRange.startOffset === newRange.startOffset;
  const touchEnd = intersectedRange.endOffset === newRange.endOffset;
  if (touchStart) {
    rangesToInsert.push({
      startOffset: newRange.endOffset,
      endOffset: intersectedRange.endOffset,
      count: intersectedRange.count,
    });
  } else if (touchEnd) {
    rangesToInsert.unshift({
      startOffset: intersectedRange.startOffset,
      endOffset: newRange.startOffset,
      count: intersectedRange.count,
    });
  } else {
    // newRange is completely nested inside intersectedRange
    rangesToInsert.push({
      startOffset: newRange.endOffset,
      endOffset: intersectedRange.endOffset,
      count: intersectedRange.count,
    });
    rangesToInsert.unshift({
      startOffset: intersectedRange.startOffset,
      endOffset: newRange.startOffset,
      count: intersectedRange.count,
    });
  }

  const resultingRanges = [...successiveRanges];
  resultingRanges.splice(intersectionIndex, 1, ...rangesToInsert);
  return resultingRanges;
}

/* testblock:start */
export const _mergeRange = mergeRange;
/* testblock:end */
