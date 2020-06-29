import * as upath from 'upath';
import { observableDiff } from 'deep-diff';
import { isObject } from 'util';
/* eslint-disable import/no-unresolved */ // TODO configure local module resolution (for development purposes)
import { AstEntity } from '@drill4j/test2code-types';
import storage from '../storage';

// TODO move type definitions to d.ts
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
          name = '',
          params = [],
          statements = [],
          returnType = 'void',
          loc: { start: { line: start = 0 } = {}, end: { line: end = 0 } = {} } = {},
        }) => {
          const probes = [start, ...statements, end].sort((a, b) => (a - b));
          return {
            name,
            params,
            returnType,
            probes,
            count: probes.length,
            start,
            statements,
            end,
          };
        },
      ),
    };
  });
}

export async function getAst(branch = 'master'): Promise<any> {
  const ast = await storage.getAst(branch);
  return ast;
}

export function validateAst(ast, branch) { // TODO describe AST
  const isAstInvalid = !ast
    || !Array.isArray(ast.data)
    || ast.data.length === 0;
  if (isAstInvalid) {
    throw new Error(`AST missing, malformed, or contains no elements! branch: ${branch}`);
  }
}

export async function saveAst(data): Promise<any> {
  await storage.saveAst(data);
}
