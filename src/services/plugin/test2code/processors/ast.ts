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
import * as upath from 'upath';
import normalizeScriptPath from '@util/normalize-script-path';

export function formatAst(astTreeData) {
  return astTreeData.map(({ path, suffix, methods = [] }) => ({
    filePath: upath.toUnix(path), // #FIX1 (see bellow)
    suffix,
    methods: methods.map(({ name, parentNameChain, params = [], probes, returnType = 'void', checksum, range, location }) => ({
      name: `${parentNameChain ? `${parentNameChain}.` : ''}${name}`,
      params,
      range,
      location,
      returnType,
      checksum,
      probes,
      count: probes.length,
    })),
  }));
}

export function formatForBackend(data) {
  return data.map(file => {
    // FIXME move normalizeScriptPath call to "formatAst" (line #FIX1)
    const parsedPath = upath.parse(normalizeScriptPath(file.filePath));
    const path = parsedPath.dir;
    const name = parsedPath.base + (file.suffix ? `.${file.suffix}` : '');
    return {
      path,
      name,
      methods: convertMethodsToSequentialProbes(file.methods),
    };
  });
}

function convertMethodsToSequentialProbes(methods) {
  let probeCounter = 0;

  return methods.reduce((acc, x) => {
    const method: any = {
      name: x.name,
      params: x.params,
      returnType: x.returnType,
      probes: getRangeOfNumbers(probeCounter, x.probes.length),
      count: x.count,
    };
    if (x.checksum) {
      method.checksum = x.checksum;
    }
    probeCounter += x.probes.length;
    acc.push(method);
    return acc;
  }, []);
}

function getRangeOfNumbers(start, length) {
  return new Array(length).fill(undefined).map((_, i) => i + start);
}
