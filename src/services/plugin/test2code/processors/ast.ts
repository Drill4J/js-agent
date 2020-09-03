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
    end: Location
  }
  returnType?: string
}

interface Location {
  line: number;
  column: number;
}

export function formatAst(astTreeData) {
  return astTreeData.map(({ filePath, suffix, methods = [] }) => ({
    filePath: upath.toUnix(filePath),
    suffix,
    methods: methods.map(
      ({
        name,
        parentNameChain,
        params = [],
        probes,
        returnType = 'void',
        checksum,
      }) => ({
        name: `${parentNameChain ? `${parentNameChain}.` : ''}${name}`,
        params,
        returnType,
        checksum,
        probes,
        count: probes.length,
      }),
    ),
  }));
}

export function formatForBackend(data) {
  return data.map(file => {
    const parsedPath = upath.parse(normalizeScriptPath(file.filePath));
    const path = parsedPath.dir;
    const name = parsedPath.base + (file.suffix ? ` (class ${file.suffix})` : '');
    return {
      path,
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
