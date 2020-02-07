import { getCoverageData, getAstData } from '../storage';
import convertSourceMap from 'convert-source-map';
import { SOURCE_MAP_FOLDER } from '../constants';
import { mainScriptNames } from '../controllers/source.maps';
import v8toIstanbul from 'v8-to-istanbul';
import { SourceMapConsumer } from 'source-map';

const filters = [
  'node_modules',
  '.html',
  '.css',
  '.pre-build-optimizer.js',
  '$_lazy_route_resource',
  'environment.ts',
];

export function getCoverageForBuild(uuid: string) {
  const targetCoverage = getCoverageData(uuid);
  const astData = getAstData().data;

  const data = [];

  astData.forEach(result => {
    const file = result.filePath;

    const fileCoverage = targetCoverage.filter(tc =>
      tc.coverage.find(it => file.includes(it.source))
    );

    const cov = {
      file,
      methods: [],
    };

    result.data.methods.forEach(m => {
      const start = m.loc.start.line;
      const end = m.loc.end.line;

      fileCoverage.forEach(c => {
        const totalLines = c.coverage.filter(
          it =>
            file.includes(it.source) &&
            it.originalLine >= start &&
            it.originalLine <= end
        );

        const coveredLines = totalLines
          .filter(it => it.hits === 1)
          .map(it => it.originalLine);

        const allLines = totalLines.map(it => it.originalLine);

        const method = cov.methods.find(it => it.method === m.name);

        if (method && coveredLines.length > 0) {
          method.coveredLines = [
            ...new Set([...method.coveredLines, ...coveredLines]),
          ];
          method.lines = [...new Set([...method.lines, ...allLines])];
          method.tests.push(c.testName);
        } else if (!method) {
          const d = {
            method: m.name,
            lines: [...new Set(allLines)],
            coveredLines: [...new Set(coveredLines)],
            tests: [],
          };

          if (coveredLines.length > 0) {
            d.tests.push(c.testName);
          }

          cov.methods.push(d);
        }
      });
    });

    data.push(cov);
  });

  return data;
}

export async function processCoverageData(sources, coverage) {
  return await processCoverage(sources, coverage);
}

async function processCoverage(sources: any, coverage: any) {
  console.error(`Use script filters ${JSON.stringify(mainScriptNames)}`);

  const result = [];

  for (const element of coverage) {
    const url = element.url;
    const scriptName = url.substring(url.lastIndexOf('/') + 1);

    if (!url) {
      continue;
    }

    if (!scriptName || !mainScriptNames.some(it => it.includes(scriptName))) {
      console.error(`Script was filtered ${scriptName}`);
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
  return convertSourceMap.fromMapFileSource(source, SOURCE_MAP_FOLDER);
}

async function cover(
  scriptName: string,
  rawSource: any,
  sourceMap: any,
  v8coverage: any
) {
  const cov = await applyCoverage(
    `${SOURCE_MAP_FOLDER}/${scriptName}`,
    rawSource,
    sourceMap,
    v8coverage
  );

  const coverage = cov[`${SOURCE_MAP_FOLDER}/${scriptName}`];

  const fnMap = coverage.fnMap;
  const f = coverage.f;

  const func = convertFunctionCoverage(fnMap, f);

  return await applyCoverageToSourceMap(sourceMap, func);
}

async function applyCoverage(
  path: string,
  rawSource: any,
  sourceMap: any,
  coverage: any
) {
  const converter = v8toIstanbul(path, undefined, {
    source: rawSource,
    sourceMap,
  });
  await converter.load();
  converter.applyCoverage(coverage);
  return converter.toIstanbul();
}

function convertFunctionCoverage(fnMap: object, f: any) {
  return Object.entries(fnMap).map(([k, { name, decl }]) => {
    const hits = f[k];
    return {
      name,
      hits,
      start: decl.start,
      end: decl.end,
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
      it.generatedLine === jsFunction.start.line &&
      it.generatedColumn === jsFunction.start.column
  );

  if (mappings.length > 0) {
    return mappings[0].source;
  }

  mappings = codeMappings.filter(
    (it: any) =>
      it.generatedColumn === it.originalColumn &&
      it.generatedLine === jsFunction.start.line
  );
  if (mappings.length < 1) {
    return null;
  }

  return mappings[0].source;
}

function getMappingsForFunction(
  fileName: string,
  codeMappings: any,
  jsFunction: any
) {
  const firstLine = jsFunction.start;
  const lastLine = jsFunction.end;

  const fileMappings = codeMappings.filter((m: any) => {
    return (
      m.source === fileName &&
      m.generatedLine >= firstLine.line &&
      m.generatedLine <= lastLine.line
    );
  });

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
