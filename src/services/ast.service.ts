/* eslint-disable import/no-unresolved */
import * as upath from 'upath';
import { observableDiff } from 'deep-diff';
import { isObject } from 'util';
import { AstEntity } from '@drill4j/test2code-types';
import storage from '../storage';

interface Ast {
  branch: string;
  data: AstData[];
  originalData: AstData[];
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
    end: Location
  }
  returnType?: string
}

interface Location {
  line: number;
  column: number;
}

export async function getAstDiff(branch: string): Promise<any> {
  const { originalData: latest }: Ast = await storage.getAst(branch);
  const { originalData: old }: Ast = await storage.getAst('master');

  const result = {
    new: [],
    updated: [],
  };

  if (!old || old.length === 0) {
    return result;
  }

  /*
  kind - indicates the kind of change; will be one of the following:
    N - indicates a newly added property/element
    D - indicates a property/element was deleted
    E - indicates a property/element was edited
    A - indicates a change occurred within an array
  */
  observableDiff(
    old,
    latest,
    d => {
      if (d.item && d.item.kind === 'N' && isObject(d.item.rhs)) {
        const { name } = d.item.rhs;
        if (name) {
          result.new.push(name);
        }
      } else if (d.item && d.item.kind === 'N' && !isObject(d.item.rhs)) {
        const method = old[d.path[0]][d.path[1]][d.path[2]][d.path[3]];
        result.updated.push(method.name);
      }
    },
    (path, key) => key === 'loc',
  );

  return result;
}

export function formatAst(astTreeData): AstEntity[] {
  return astTreeData.map(({ filePath, data: { methods = [] } }) => {
    const unixFilePath = upath.toUnix(filePath);
    const unixPath = unixFilePath.substr(1, unixFilePath.lastIndexOf('/') - 1);
    const unixName = unixFilePath.substr(unixFilePath.lastIndexOf('/') + 1);
    return {
      path: unixPath,
      name: unixName,
      methods: methods.map(
        ({
          name = '', params = [], returnType = 'void', loc: { start: { line: start = 0 } = {}, end: { line: end = 0 } = {} } = {},
        }) => ({
          name,
          params,
          returnType,
          probes: new Array(end - start).fill(0),
          count: end - start,
        }),
      ),
    };
  });
}

export async function getAst(branch = 'master'): Promise<any> {
  const data = await storage.getAst(branch);
  return data;
}

export async function saveAst(data): Promise<any> {
  await storage.saveAst(data);
}
