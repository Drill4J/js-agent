import v8toIstanbul from 'v8-to-istanbul';
import convertSourceMap from 'convert-source-map';
import { SourceMapConsumer } from 'source-map';
import * as upath from 'upath';
import fsExtra from 'fs-extra';

/* eslint-disable import/no-unresolved */ // TODO configure local-module-first resolution (for development purposes)
import { ExecClassData } from '@drill4j/test2code-types';

import storage from '../../../../storage';
import LoggerProvider from '../../../../util/logger';

const logger = LoggerProvider.getLogger('drill', 'coverage-processor');

const sourceMapFolder = process.env.SOURCE_MAP_FOLDER || './sourceMaps';

const filters = [
  'node_modules',
  '.html',
  '.css',
  '.pre-build-optimizer.js',
  '$_lazy_route_resource',
  'environment.ts',
];

export async function saveSourceMap(agentId, sourceMap) {
  // TODO fix: anything besides valid sourceMap with .file property breaks this code
  const scriptName = upath.basename(sourceMap.file);
  const fileName = `${sourceMapFolder}${upath.sep}${scriptName}.map`;
  await fsExtra.ensureDir(`${sourceMapFolder}`);
  await fsExtra.writeJSON(fileName, sourceMap);

  // TODO fix: that solution will break in either case of scriptName change on-the-fly or multiple script names
  await storage.addMainScriptName(scriptName);
}

export async function mapCoverageToFiles(test: any, coverage: any, files: any): Promise<ExecClassData[]> {
  const data = files.map((file) => mapCoverageToFile(coverage, file));

  return concatFileProbes(test.name, data);
}

function mapCoverageToFile(coverage, file) {
  const { filePath } = file;

  const result = {
    file: filePath,
    methods: [],
  };

  result.methods = file.methods.map(astMethod => {
    // TODO "method" is not guaranteed to be an actual method, it could be a class member, e.g. a static property
    // think of a way to deal with that (or just change naming everywhere?)
    const linesCoveredByTest = getLinesCoveredByTest(coverage, astMethod, filePath);

    const newMethod = {
      method: astMethod.name,
      probes: astMethod.probes,
      coveredLines: linesCoveredByTest,
    };

    return newMethod;
  });

  return result;
}

function getLinesCoveredByTest(lineCoverage, astMethod, filePath) {
  const totalLines = lineCoverage.filter(
    it =>
      filePath.includes(transformPath(it.source)) &&
      it.originalLine >= astMethod.start &&
      it.originalLine <= astMethod.end,
  );
  if (totalLines.length === 0) return [];

  const coveredLines = totalLines
    .filter(it => it.hits === 1) // TODO hits >== 1?
    .map(it => it.originalLine);

  const uniqueCoveredLines = [...new Set(coveredLines)];
  return uniqueCoveredLines;
}

function transformPath(path) {
  const result = path.replace(/^(?:\.\.\/)+/, '');
  return result;
}

function concatFileProbes(testName, coverage) {
  const data = coverage
    .map(({ file, methods = [] }) => {
      const probes = concatMethodsProbes(methods);

      const className = upath.toUnix(file);
      return {
        id: 0,
        className: className.substring(1, className.length),
        probes,
        testName,
      };
    })
    .filter(({ probes }) => probes.length);

  return data;
}

function concatMethodsProbes(methods) {
  const data = methods.reduce((fileProbes, method) => {
    const methodProbes = method.probes.reduce((acc, probe) => {
      acc.push(method.coveredLines.indexOf(probe) > -1);
      return acc;
    }, []);
    return [...fileProbes, ...methodProbes];
  }, []);
  return data;
}

export async function processTestResults(agentId, ast, rawData) {
  const {
    coverage: rawCoverage,
    test,
    scriptSources: sources,
  } = rawData;

  const coverage = await convertCoverage(sources, rawCoverage);

  const data = await mapCoverageToFiles(test, coverage, ast);

  return data;
}

async function convertCoverage(sources: any, coverage: any) {
  const result = [];

  const mainScriptNames = await storage.getMainScriptNames();
  if (!Array.isArray(mainScriptNames) || mainScriptNames.length === 0) {
    // TODO extend error and dispatch it in cetralized error handler
    throw new Error('Script names not found. You are probably missing source maps?');
  }
  logger.silly(`using script filters ${mainScriptNames}`);

  for (const element of coverage) {
    const { url } = element;
    if (!url) {
      continue;
    }

    const scriptName = url.substring(url.lastIndexOf('/') + 1);

    if (!scriptName || !mainScriptNames.some(it => it.includes(scriptName))) {
      logger.silly(`Script was filtered ${scriptName}`);
      continue;
    }

    const script = sources[url];
    if (!script) {
      continue;
    }

    const rawSource = script.source;
    const v8coverage = element.functions;

    const sourceMap = convertRawSourceMap(rawSource);

    if (
      sourceMap == null ||
      !sourceMap.sourcemap ||
      !sourceMap.sourcemap.file.includes(scriptName)
    ) {
      logger.error(`there is no source map for ${scriptName}`);
      continue;
    }
    logger.debug(`script was processed ${scriptName}`);
    const cov = await cover(scriptName, rawSource, sourceMap, v8coverage);
    result.push(...cov);
  }

  return result;
}

function convertRawSourceMap(source: any) {
  return convertSourceMap.fromMapFileSource(source, sourceMapFolder);
}

async function cover(
  scriptName: string,
  rawSource: any,
  sourceMap: any,
  v8coverage: any,
) {
  const cov = await convertFromV8ToIstanbul(
    `${sourceMapFolder}/${scriptName}`,
    rawSource,
    sourceMap,
    v8coverage,
  );

  const coverage = cov[Object.keys(cov)[0]];

  const { fnMap } = coverage;
  const { f } = coverage;

  const func = convertFunctionCoverage(fnMap, f);

  return applyCoverageToSourceMap(sourceMap, func);
}

async function convertFromV8ToIstanbul(
  path: string,
  rawSource: any,
  sourceMap: any,
  coverage: any,
) {
  const converter = v8toIstanbul(path, undefined, {
    source: rawSource,
    sourceMap,
  });
  await converter.load();
  converter.applyCoverage(coverage);
  const result = converter.toIstanbul();
  return result;
}

function convertFunctionCoverage(fnMap: unknown, f: any) { // TODO git rid of unknown type
  return Object.entries(fnMap).map(([k, { name, decl }]) => {
    const hits = f[k];
    return {
      name,
      hits,
      start: decl?.start,
      end: decl?.end,
    };
  });
}

async function getMappings(rawSourceMap: any) {
  const codeMappings: any = [];

  await SourceMapConsumer.with(rawSourceMap.sourcemap, null, consumer => {
    consumer.eachMapping(m => {
      if (m.source === null || filters.some(f => m.source.includes(f))) {
        return;
      }

      codeMappings.push(m);
    });
  });

  return codeMappings;
}

async function applyCoverageToSourceMap(sourceMap: any, func: any) {
  const codeMappings = await getMappings(sourceMap);

  return func.reduce((results: any, jsFunction: any) => {
    const fileName = getFileName(codeMappings, jsFunction);
    if (!fileName) {
      return results;
    }

    const mappings = getMappingsForFunction(fileName, codeMappings, jsFunction);

    mappings.forEach((m: any) => {
      results.push({
        source: m.source.replace('webpack://', ''),
        originalLine: m.originalLine,
        originalColumn: m.originalColumn,
        hits: jsFunction.hits,
        generatedLine: m.generatedLine,
        generatedColumn: m.generatedColumn,
      });
    });
    return results;
  }, []);
}

function getFileName(codeMappings: any, jsFunction: any) {
  let mappings = [];

  mappings = codeMappings.filter(
    (it: any) =>
      it.generatedLine === jsFunction?.start?.line &&
      it.generatedColumn === jsFunction?.start?.column,
  );

  if (mappings.length > 0) {
    return mappings[0].source;
  }

  mappings = codeMappings.filter(
    (it: any) =>
      it.generatedColumn === it.originalColumn &&
      it.generatedLine === jsFunction?.start?.line,
  );
  if (mappings.length < 1) {
    return null;
  }

  return mappings[0].source;
}

function getMappingsForFunction(
  fileName: string,
  codeMappings: any,
  jsFunction: any,
) {
  const firstLine = jsFunction?.start;
  const lastLine = jsFunction?.end;

  const fileMappings = codeMappings.filter((m: any) => (
    m.source === fileName &&
    m.generatedLine >= firstLine.line &&
    m.generatedLine <= lastLine.line
  ));

  return fileMappings.filter((m: any) => {
    const line = m.generatedLine;

    if (line > firstLine.line && line < lastLine.line) {
      return true;
    }

    if (line === firstLine.line) {
      return m.generatedColumn >= firstLine.column;
    }

    if (line === lastLine.line) {
      return m.generatedColumn <= lastLine.column;
    }

    return false;
  });
}
