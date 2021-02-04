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
/* eslint-disable no-plusplus */
/* eslint-disable for-direction */
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
      const result = mergeRange(acc2, range);
      return result;
    }, acc);
  }, <RawSourceCoverage[]>[]);
}

function mergeRange(successiveRanges: RawSourceCoverage[], newRange: RawSourceCoverage): RawSourceCoverage[] {
  const rangesToInsert: RawSourceCoverage[] = [newRange];
  if (successiveRanges.length === 0) {
    return rangesToInsert;
  }

  const intersectionIndex = binarySearchRange(successiveRanges, newRange.startOffset); // only startOffset alters coverage?

  // FIXME check that
  // const intersectionIndexLeft = binarySearchRange(successiveRanges, newRange.startOffset);
  // const intersectionIndexRight = binarySearchRange(successiveRanges, newRange.endOffset);
  // if (intersectionIndexLeft !== intersectionIndexRight) {
  //   throw new Error('new range spans across multiple ranges');
  // }
  // const intersectionIndex = intersectionIndexRight;

  // FIXME can a newRange span across multiple successive ranges?
  if (intersectionIndex === -1) {
    const rightNeighboringRange = successiveRanges.findIndex(range => range.startOffset >= newRange.endOffset) > -1;
    if (rightNeighboringRange) {
      // TODO measure on larger test sets (never "true" on simple page refresh on Report Portal)
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

  spliceOriginal(successiveRanges, rangesToInsert, intersectionIndex, 1);
  return successiveRanges;
}

function spliceOriginal(original, newEntries, insertionIndex, spliceCount) {
  // eslint-disable-next-line no-param-reassign
  original.length += newEntries.length - spliceCount;

  // move values "forward"
  for (let i = original.length - 1; i >= insertionIndex + newEntries.length; i--) {
    // eslint-disable-next-line no-param-reassign
    original[i] = original[i - newEntries.length + spliceCount];
  }

  // insert arr2 values
  for (let i = 0; i < newEntries.length; i++) {
    // eslint-disable-next-line no-param-reassign
    original[i + insertionIndex] = newEntries[i];
  }

  return original;
}

export function binarySearchRange(successiveRanges: RawSourceCoverage[], offset: number): number {
  let start = 0;
  let end = successiveRanges.length - 1;

  while (start <= end) {
    const mid = Math.floor((start + end) / 2);

    if (successiveRanges[mid].startOffset <= offset && successiveRanges[mid].endOffset >= offset) return mid;

    if (successiveRanges[mid].endOffset < offset) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return -1;
}

/* testblock:start */
export const _mergeRange = mergeRange;
/* testblock:end */
