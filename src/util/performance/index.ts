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
import { nanoid } from 'nanoid';
import CliTable from 'cli-table3';
import { performance, PerformanceObserver } from 'perf_hooks';
import { median, average, total, min, max } from './stat-functions';
/**
 * DISCLAIMER: this is very naive performance measurement implementation
 * - total time measured for async functions called inside Promise.all(...) won't add up (because of the overlap)!
 *   (look at max time instead)
 * - it might skew & degrade performance to some degree
 */

type StatFunction = (values: any[]) => any;
const statFunctions: StatFunction[] = [
  function count(values) {
    return values.length;
  },
  total,
  average,
  min,
  max,
  median,
];
const diff = { total: true, min: true, max: true };

let entries = {};
let prevMarkerData;
let markCalls = 0;
let measureCalls = 0;

const markers = {};

global.prf = {
  mark(name: string) {
    if (process.env.PERF_MEASUREMENT_ENABLED !== 'true') return '';
    // eslint-disable-next-line no-plusplus
    markCalls++;
    const id = `${name}/${nanoid()}`;
    performance.mark(id);
    markers[id] = true;
    return id;
  },
  measure(id: string) {
    if (process.env.PERF_MEASUREMENT_ENABLED !== 'true') return;
    if (!markers[id]) {
      throw new Error(`no marker with id ${id}`);
    }
    // eslint-disable-next-line no-plusplus
    measureCalls++;
    performance.mark(`${id}-end`);
    performance.measure(id.split('/')[0], id, `${id}-end`);
  },
  print() {
    if (process.env.PERF_MEASUREMENT_ENABLED !== 'true') return;
    const markerData = calcStats();
    const table = new CliTable({
      head: ['', ...statFunctions.map(fn => fn.name)],
    });
    markerData.forEach(marker => {
      const prevMarker = Array.isArray(prevMarkerData) && prevMarkerData.find(x => x.name === marker.name);
      const formattedValues = marker.stats.map(stat => {
        let compare = '';
        if (process.env.PERF_DIFFS_ENABLED === 'true' && diff[stat.name]) {
          const prevStat = prevMarker && Array.isArray(prevMarker.stats) && prevMarker.stats.find(x => x.name === stat.name);
          compare = prevStat ? getTimesDiff(stat.value, prevStat.value) : '';
        }
        // eslint-disable-next-line no-param-reassign
        return `${compare} ${round(stat.value)}`;
      });
      table.push({ [marker.name]: formattedValues });
    });

    console.log(table.toString());
    if (markCalls !== measureCalls) {
      console.log(`Performance measurement util error:
        \n ${markCalls} - mark() calls
        \n ${measureCalls} - measure() calls
        \n Those numbers must match! Performance data is skewed
        \n You've likely forgot to place some calls`);
    }

    prevMarkerData = markerData;
  },
  flush() {
    if (process.env.PERF_MEASUREMENT_ENABLED !== 'true') return;
    markCalls = 0;
    measureCalls = 0;
    entries = {};
  },
};
export default global.prf;

function calcStats(): any {
  return Object.keys(entries).map(markerName => ({
    name: markerName,
    stats: statFunctions.map(fn => ({
      name: fn.name,
      value: fn(entries[markerName].map(x => x.duration)),
    })),
  }));
}

function round(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function getTimesDiff(next, prev) {
  const scaler = next / prev;
  if (scaler === 1) return '';

  if (scaler < 1) return `x${(prev / next).toFixed(2)} ^`;
  return `x${scaler.toFixed(2)} v`;
}

const performanceObserver = new PerformanceObserver(list => {
  const entry = list.getEntries()[0];
  if (!entries[entry.name]) {
    entries[entry.name] = [];
  }
  entries[entry.name].push(entry);
});
performanceObserver.observe({ entryTypes: ['measure'], buffered: false }); // TODO try to utilize buffered: true
