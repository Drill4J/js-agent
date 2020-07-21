import * as upath from 'upath';

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
    end: Location
  }
  returnType?: string
}

interface Location {
  line: number;
  column: number;
}

export function formatAst(astTreeData) {
  return astTreeData.map(({ filePath, data: { methods = [] } }) => ({
    filePath: upath.toUnix(filePath),
    methods: methods.map(
      ({
        name = '',
        params = [],
        statements = [],
        returnType = 'void',
        checksum = '',
        loc: { start: { line: start = 0 } = {}, end: { line: end = 0 } = {} } = {},
      }) => {
        const probes = [...new Set([start, ...statements, end])].sort((a, b) => (a - b));
        return {
          name,
          params,
          returnType,
          checksum,
          probes,
          count: probes.length,
          start,
          statements,
          end,
        };
      },
    ),
  }));
}

export function formatForBackend(data) {
  return data.map(file => {
    const path = upath.dirname(file.filePath);
    const name = upath.basename(file.filePath);
    return {
      path: path.substring(1, path.length),
      name,
      methods: file.methods.map(x => ({
        name: x.name,
        params: x.params,
        returnType: x.returnType,
        probes: x.probes,
        count: x.count,
        checksum: x.checksum,
      })),
    };
  });
}
