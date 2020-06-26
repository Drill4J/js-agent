import v8toIstanbul from 'v8-to-istanbul';
import convertSourceMap from 'convert-source-map';
import { SourceMapConsumer } from 'source-map';
import * as upath from 'upath';

import * as pluginService from './plugin.service';
import { getAst, validateAst } from './ast.service';
import storage from '../storage';

const sourceMapFolder = process.env.SOURCE_MAP_FOLDER || './sourceMaps'; // TODO that constant is used twice (see controllers/source.map.ts)

const filters = [
  'node_modules',
  '.html',
  '.css',
  '.pre-build-optimizer.js',
  '$_lazy_route_resource',
  'environment.ts',
];

function transformPath(path) {
  const result = path.replace(/^(?:\.\.\/)+/, '');
  return result;
}

export async function getScopeTests(branch = 'master') {
  const data = await storage.getCoverage(branch);
  return data;
}

export async function getCoverageForBuild(branch: string) {
  const astTree = await getAst(branch);
  validateAst(astTree, branch);

  const { data: files } = astTree;

  const scopeTests = await this.getScopeTests(branch);

  const data = files.map(file => {
    // TODO it was split before in formatAst method. Think of a better way to store file's path & name
    const filePath = upath.toUnix(upath.join(file.path, file.name));
    const fileAccumulatedCoverage = {
      file: filePath,
      methods: [],
    };
    const fileTests = getFileTests(filePath, scopeTests);

    if (fileTests.length === 0) {
      return fileAccumulatedCoverage; // TODO returning the same variable twice is misleading, refactor
    }

    file.methods.forEach(astMethod => {
      // TODO "method" is not guaranteed to be an actual method, it could be a class member, e.g. a static property
      // think of a way to deal with that (or just change naming everywhere?)
      fileTests.forEach(fileTest => {
        const linesCoveredByTest = getLinesCoveredByTest(astMethod, filePath, fileTest.data);
        if (linesCoveredByTest.length === 0) return;

        const index = fileAccumulatedCoverage.methods.findIndex(x => x.method === astMethod.name);
        const isMethodIncluded = index > -1;

        if (isMethodIncluded) {
          const method = fileAccumulatedCoverage.methods[index];

          method.coveredLines = [...new Set([...method.coveredLines, ...linesCoveredByTest])];

          const isTestAbsent = method.tests.findIndex(x => x.name === fileTest.test.name) === -1;
          if (isTestAbsent) {
            method.tests.push(fileTest.test);
          }
          return;
        }

        const newMethod = {
          method: astMethod.name,
          probes: astMethod.probes,
          coveredLines: linesCoveredByTest,
          tests: [fileTest.test],
        };

        fileAccumulatedCoverage.methods.push(newMethod);
      });
    });

    return fileAccumulatedCoverage;
  });

  return { branch, coverage: data };
}

function getFileTests(filePath, scopeTests) {
  const result = scopeTests
    .map(x => ({
      branch: x.branch,
      test: x.test,
      data: x.data.filter(method => filePath.includes(transformPath(method.source))),
    }))
    .filter(x => x.data.length > 0);
  return result;
}

function getLinesCoveredByTest(astMethod, filePath, lineCoverage) {
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

export async function processTestResults(test, branch, sources, coverage) {
  const coverageData = await processCoverageData(sources, coverage);

  await storage.saveCoverage({
    branch,
    test,
    data: coverageData,
  });

  const { coverage: data = [] } = await this.getCoverageForBuild('master');

  // TODO appending test name does not make any sense. Either single test data is sent or all in-one-go
  await pluginService.sendCoverageToDrill(test.name, data);
}

async function processCoverageData(sources: any, coverage: any) {
  const result = [];

  const mainScriptNames = await storage.getMainScriptNames();
  if (!Array.isArray(mainScriptNames) || mainScriptNames.length === 0) {
    // TODO extend error and dispatch it in cetralized error handler
    throw new Error('Script names not found. You are probably missing source maps?');
  }
  console.log(`Using script filters ${mainScriptNames}`);

  for (const element of coverage) {
    const { url } = element;
    const scriptName = url.substring(url.lastIndexOf('/') + 1);

    if (!url) {
      continue;
    }

    if (!scriptName || !mainScriptNames.some(it => it.includes(scriptName))) {
      console.warn(`Script was filtered ${scriptName}`);
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
      console.error(`There is no source map for ${scriptName}`);
      continue;
    }
    console.log(`Script was processed ${scriptName}`);
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
  const cov = await applyCoverage(
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

async function applyCoverage(
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

export async function getBuildRisks(branch) {
  const coverage = await getCoverageForBuild(branch);

  const methods = [];

  coverage.coverage.map(it => methods.push(...it.methods));

  return methods.filter(it => it.tests.length === 0);
}
