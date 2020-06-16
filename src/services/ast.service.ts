/* eslint-disable import/no-unresolved */
import { observableDiff } from 'deep-diff';
import { isObject } from 'util';
import { AstEntity } from '@drill4j/test2code-types';
import { getAstData } from '../storage';

interface Ast {
  branch: string;
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
    end: Location
  }
  returnType?: string
}

interface Location {
  line: number;
  column: number;
}

export function getAstDiff(branch: string) {
  const latest = getAstData(branch).data;
  const old = getAstData('master').data;

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

export function getAstTree(branch: string) {
  const ast = getAstData(branch).data;
  const data = [];
  ast.forEach(r => {
    const methods = [];
    r.data.methods.forEach(m => {
      methods.push({
        name: m.name,
        params: m.params,
      });
    });

    data.push({
      fileName: r.filePath,
      methods,
    });
  });

  return data;
}

export function getFormattedAstTree(branch?: string): AstEntity[] {
  const { data }: Ast = getAstData(branch);
  return data.map(({ filePath, data: { methods = [] } }) => ({
    path: filePath.substr(1, filePath.lastIndexOf('/') - 1),
    name: filePath.substr(filePath.lastIndexOf('/') + 1),
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
  }));
}
