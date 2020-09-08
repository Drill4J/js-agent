import v8toIstanbul from 'v8-to-istanbul';
import convertSourceMap from 'convert-source-map';
import { SourceMapConsumer } from 'source-map';
import * as upath from 'upath';
import fsExtra from 'fs-extra';
import crypto from 'crypto';

/* eslint-disable import/no-unresolved */ // TODO configure local-module-first resolution (for development purposes)
import { ExecClassData } from '@drill4j/test2code-types';

import storage from '../../../../storage';
import LoggerProvider from '../../../../util/logger';
import normalizeScriptPath from '../../../../util/normalize-script-path';

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

export async function saveSourceMaps(agentId: string, sourcemaps: any[]): Promise<void> {
  const dirPath = `${sourceMapFolder}${upath.sep}${agentId}`;
  await fsExtra.ensureDir(dirPath);

  const scriptsNames = await Promise.all(sourcemaps.map(async (sourcemap) => {
    const name = upath.basename(sourcemap.file);
    const fileName = `${dirPath}${upath.sep}${name}.map`;
    await fsExtra.writeJSON(fileName, sourcemap);
    return name;
  }));

  await storage.saveBundleScriptsNames(agentId, scriptsNames);
}

// TODO refactor, naming is confusing
export async function mapCoverageToFiles(test: any, coverage: any, files: any): Promise<ExecClassData[]> {
  const fileMappedCoverage = files.map((file) => mapCoverageToFile(coverage, file));
  const filesWithProbes = concatFileProbes(test.name, fileMappedCoverage);
  return filesWithProbes.filter(file => file.probes.includes(true));
}

function mapCoverageToFile(coverage, file) {
  const { filePath } = file;

  const result = {
    file: filePath,
    methods: [],
  };
  if (file.suffix) {
    result.file += `.${file.suffix}`;
  }

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
  const coveredLines = lineCoverage
    .filter(x =>
      filePath.includes(normalizeScriptPath(x.source)) &&
      astMethod.probes.includes(x.originalLine) &&
      x.hits > 0)
    .reduce((result, x) =>
      result.add(x.originalLine), new Set());

  return Array.from(coveredLines);
}

function concatFileProbes(testName, coverage) {
  const data = coverage
    .map(({ file, methods = [] }) => {
      const probes = concatMethodsProbes(methods);

      const className = normalizeScriptPath(file);
      return {
        id: 0,
        className,
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

export async function processTestResults(agentId, ast, rawData, bundleHashes: { file: string, hash: string }[]) {
  const {
    coverage: rawCoverage,
    test,
    scriptSources: sources,
  } = rawData;

  const coverage = await convertCoverage(agentId, sources, rawCoverage, bundleHashes);

  const data = await mapCoverageToFiles(test, coverage, ast);

  return data;
}

async function convertCoverage(agentId: string, sources: any, coverage: any, bundleHashes: { file: string, hash: string }[]) {
  const result = [];

  const bundleScriptsNames = await storage.getBundleScriptsNames(agentId);
  if (!Array.isArray(bundleScriptsNames) || bundleScriptsNames.length === 0) {
    // TODO extend error and dispatch it in cetralized error handler
    throw new Error('Bundle script names not found. You are probably missing source maps?');
  }
  logger.silly(`using script filters ${bundleScriptsNames}`);

  for (const element of coverage) {
    const { url } = element;
    if (!url) {
      continue;
    }

    const scriptName = url.substring(url.lastIndexOf('/') + 1);

    if (!scriptName || !bundleScriptsNames.some(it => it.includes(scriptName))) {
      logger.silly(`Script was filtered ${scriptName}`);
      continue;
    }

    const script = sources[url];
    if (!script) {
      continue;
    }

    const scriptHash = crypto
      .createHash('sha256')
      .update(script.source.replace(/\r\n/g, '\n'))
      .digest('hex');
    const isSameBundle = bundleHashes.findIndex(({ file, hash }) => file.includes(scriptName) && scriptHash === hash) > -1;
    if (!isSameBundle) throw new Error(`coverage processing: bundle hash mismatch for script ${url}`);

    const rawSource = script.source;
    const v8coverage = element.functions;

    const sourceMap = convertRawSourceMap(agentId, rawSource);

    if (
      sourceMap == null ||
      !sourceMap.sourcemap ||
      !sourceMap.sourcemap.file.includes(scriptName)
    ) {
      logger.error(`there is no source map for ${scriptName}`);
      continue;
    }
    logger.debug(`script was processed ${scriptName}`);
    const cov = await cover(agentId, scriptName, rawSource, sourceMap, v8coverage);
    result.push(...cov);
  }

  return result;
}

function convertRawSourceMap(agentId: string, source: any) {
  return convertSourceMap.fromMapFileSource(source, `${sourceMapFolder}${upath.sep}${agentId}`);
}

async function cover(
  agentId: string,
  scriptName: string,
  rawSource: any,
  sourceMap: any,
  v8coverage: any,
) {
  const cov = await convertFromV8ToIstanbul(
    `${sourceMapFolder}${upath.sep}${agentId}${upath.sep}${scriptName}`,
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
