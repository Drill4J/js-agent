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
import each from 'jest-each';
import deepFreeze from 'js-flock/deepFreeze';
import { _mergeRange } from '../../../../src/services/plugin/test2code/processors/coverage/convert/v8-to-raw';
import { RawSourceCoverage } from '../../../../src/services/plugin/test2code/processors/coverage/types';
import mutationErrorsMatcher from '../../../__util__/mutation-errors-matcher';

describe('merge of base range(covered) with nested range(not-covered)', () => {
  it('must not mutate inputs', () => {
    try {
      const mergedRanges = deepFreeze([{ count: 1, startOffset: 1, endOffset: 100 }] as RawSourceCoverage[]);
      const nestedRange = Object.freeze({ count: 0, startOffset: 25, endOffset: 75 });
      _mergeRange(mergedRanges, nestedRange);
    } catch (e) {
      expect(e).not.toEqual(mutationErrorsMatcher);
    }
  });

  it('must return 3 ranges', () => {
    const mergedRanges = [{ count: 1, startOffset: 1, endOffset: 100 }] as RawSourceCoverage[];
    const nestedRange = { count: 0, startOffset: 25, endOffset: 75 };
    const result = _mergeRange(mergedRanges, nestedRange);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toEqual(3);
  });

  it('returned ranges must have 2 touching boundaries', () => {
    const mergedRanges = [{ count: 1, startOffset: 1, endOffset: 100 }] as RawSourceCoverage[];
    const nestedRange = { count: 0, startOffset: 25, endOffset: 75 };
    const result = _mergeRange(mergedRanges, nestedRange);

    expect(result[0].endOffset).toEqual(result[1].startOffset);
    expect(result[1].endOffset).toEqual(result[2].startOffset);
  });

  it('returned range offsets must be in ascending order', () => {
    const mergedRanges = [{ count: 1, startOffset: 1, endOffset: 100 }] as RawSourceCoverage[];
    const nestedRange = { count: 0, startOffset: 25, endOffset: 75 };
    const result = _mergeRange(mergedRanges, nestedRange);
    expect(result[0].startOffset).toBeLessThan(result[0].endOffset);
    expect(result[1].startOffset).toBeLessThan(result[1].endOffset);
    expect(result[2].startOffset).toBeLessThan(result[2].endOffset);
  });

  it('returned ranges must be: covered, not-covered, covered', () => {
    const mergedRanges = [{ count: 1, startOffset: 1, endOffset: 100 }] as RawSourceCoverage[];
    const nestedRange = { count: 0, startOffset: 25, endOffset: 75 };
    const result = _mergeRange(mergedRanges, nestedRange);
    expect(result[0].count).toEqual(1);
    expect(result[1].count).toEqual(0);
    expect(result[2].count).toEqual(1);
  });
});

each([
  ['startOffset', { count: 0, startOffset: 1, endOffset: 75 }],
  ['endOffset', { count: 0, startOffset: 25, endOffset: 100 }],
]).describe('merge base range with range having the same %s', (_, nestedRange) => {
  it('must return 2 ranges', () => {
    const mergedRanges = [{ count: 1, startOffset: 1, endOffset: 100 }] as RawSourceCoverage[];
    const result = _mergeRange(mergedRanges, nestedRange);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toEqual(2);
  });

  it('must return ranges with 1 touching boundary', () => {
    const mergedRanges = [{ count: 1, startOffset: 1, endOffset: 100 }] as RawSourceCoverage[];
    const result = _mergeRange(mergedRanges, nestedRange);

    expect(result[0].endOffset).toEqual(result[1].startOffset);
  });

  it('must return ranges with offsets in ascending order', () => {
    const mergedRanges = [{ count: 1, startOffset: 1, endOffset: 100 }] as RawSourceCoverage[];
    const result = _mergeRange(mergedRanges, nestedRange);
    expect(result[0].startOffset).toBeLessThan(result[0].endOffset);
    expect(result[1].startOffset).toBeLessThan(result[1].endOffset);
  });
});

// describe('merge range with not-overlapping range', () => {
//   describe('locate right-hand-side', ()=> {
//     const originalRange = { count: 0, startOffset: 150, endOffset: 200 };
//     const rhsRange = { count: 0, startOffset: 300, endOffset: 350 };
//     //const lhsRange = { count: 0, startOffset: 1, endOffset: 50 }

//     it('must return 2 ranges', () => {
//       const result = _mergeRange([originalRange], rhsRange);
//       expect(Array.isArray(result)).toEqual(true);
//       expect(result.length).toEqual(2);
//     });

//     it('must place new range at correct side', () => {
//       const result = _mergeRange([originalRange], rhsRange);

//       const inserted = result[expectedIndexes.inserted];
//       const insertedIndex = result.findIndex(x => )

//       expect(inserted.startOffset).toEqual(rhsRange.startOffset);
//       expect(inserted.endOffset).toEqual(rhsRange.endOffset);
//       expect(inserted.count).toEqual(rhsRange.count);
//     });

//     it('must return ranges with not-altered offsets and counts', () => {
//       const result = _mergeRange([originalRange], rhsRange);

//       expect(result[0]).toEqual()

//       const inserted = result[rhsRange.inserted];

//       expect(original.startOffset).toEqual(originalRange.startOffset);
//       expect(original.endOffset).toEqual(originalRange.endOffset);
//       expect(original.count).toEqual(originalRange.count);

//       expect(inserted.startOffset).toEqual(rhsRange.startOffset);
//       expect(inserted.endOffset).toEqual(rhsRange.endOffset);
//       expect(inserted.count).toEqual(rhsRange.count);
//     });
//   })
// });
