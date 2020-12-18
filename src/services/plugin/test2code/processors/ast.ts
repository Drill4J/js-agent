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
import normalizeScriptPath from '../../../../util/normalize-script-path';

// TODO move type definitions to d.ts
interface Ast {
  buildVersion: string;
  data: AstData[];
}

interface AstData {
  methods: AstMethod[];
  filePath: string;
  data: AstData;
}

interface AstMethod {
  params?: string[];
  name: string;
  loc: {
    start: Location;
    end: Location;
  };
  returnType?: string;
}

interface Location {
  line: number;
  column: number;
}

export function formatAst(astTreeData) {
  return astTreeData.map(({ path, suffix, methods = [] }) => ({
    filePath: upath.toUnix(path),
    suffix,
    methods: methods.map(({ name, parentNameChain, params = [], probes, returnType = 'void', checksum }) => ({
      name: `${parentNameChain ? `${parentNameChain}.` : ''}${name}`,
      params,
      returnType,
      checksum,
      probes,
      count: probes.length,
    })),
  }));
}

export function formatForBackend(data) {
  return data.map(file => {
    const parsedPath = upath.parse(normalizeScriptPath(file.filePath));
    const path = parsedPath.dir;
    const name = parsedPath.base + (file.suffix ? `.${file.suffix}` : '');
    return {
      path,
      name,
      methods: file.methods.map(x => {
        const method: any = {
        name: x.name,
        params: x.params,
        returnType: x.returnType,
        probes: x.probes,
        count: x.count,
        };
        if (x.checksum) {
          method.checksum = x.checksum;
        }
        return method;
      }),
    };
  });
}
