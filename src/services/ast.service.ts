import { observableDiff } from 'deep-diff';
import { isObject } from 'util';
import { getAstData } from '../storage';

export function getAstDiff(branch) {
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
        const name = d.item.rhs.name;
        if (name) {
          result.new.push(name);
        }
      } else if (d.item && d.item.kind === 'N' && !isObject(d.item.rhs)) {
        const method = old[d.path[0]][d.path[1]][d.path[2]][d.path[3]];
        result.updated.push(method.name);
      }
    },
    (path, key) => {
      return key === 'loc';
    }
  );

  return result;
}

export function getAstTree(branch) {
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
