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
export function median(values) {
  if (values.length === 0) return 0;
  values.sort(function (a, b) {
    return a - b;
  });
  const half = Math.floor(values.length / 2);
  if (values.length % 2) return values[half];
  return (values[half - 1] + values[half]) / 2.0;
}

export function average(values) {
  return total(values) / values.length;
}

export function total(values) {
  let result = 0;
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < values.length; i++) {
    result += values[i];
  }
  return result;
}

export function min(values) {
  let minValue = Infinity;
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < values.length; i++) {
    minValue = Math.min(minValue, values[i]);
  }
  return minValue;
}

export function max(values) {
  let maxValue = -Infinity;
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < values.length; i++) {
    maxValue = Math.max(maxValue, values[i]);
  }
  return maxValue;
}
