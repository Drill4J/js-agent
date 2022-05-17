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
    /*
      ASSUMPTION
        1 original file (aka module)
        included in
        N bundle files (aka chunks)
        will have _the same number of mappings_ in all bundle files
        and thus - number of probes
        
        // @drill4j/js-parser guarantees that this assumption is true
        
      CONSEQUENCE
        we can pick a number of probes from the any bundle file
    */
    const probesLength = (Object.values(x.probes)[0] as any[]).length;
    const method: any = {
      name: x.name,
      params: x.params,
      returnType: x.returnType,
      probes: getRangeOfNumbers(probeCounter, probesLength),
      count: probesLength,
    };
    if (x.checksum) {
      method.checksum = x.checksum;
    }
    probeCounter += probesLength;
    acc.push(method);
    return acc;
  }, []);
}

function getRangeOfNumbers(start, length) {
  return new Array(length).fill(undefined).map((_, i) => i + start);
}
