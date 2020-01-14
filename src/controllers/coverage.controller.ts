import convertSourceMap, { fromBase64 } from 'convert-source-map';
import { SourceMapConsumer } from 'source-map';
import v8toIstanbul from 'v8-to-istanbul';
import { SOURCE_MAP_FOLDER } from '../constants';
import { BaseController } from './base.controller';
import { mainScriptNames } from './source.maps.controller';
import { astData } from './ast.controller';

const filters = [
  'node_modules',
  '.html',
  '.css',
  '.pre-build-optimizer.js',
  '$_lazy_route_resource',
  'environment.ts',
];

let coverageData = [];

export class CoverageController extends BaseController {
  public initRoutes() {
    this.router.post('/coverage', async (req, res) => {
      const sources = req.body.scriptSources;
      const coverage = req.body.coverage;
      const testName = req.body.testName;
      const runUuid = req.body.runUuid;

      if (mainScriptNames.length === 0) {
        const resp = {
          status: 'Error during coverage processing. Add source maps at first',
        };

        return res.status(500).send(resp);
      }

      const result = await this.processCoverage(sources, coverage);

      if (!result) {
        const resp = {
          status: 'Error during coverage processing',
          mainScriptNames,
        };

        return res.send(resp);
      }

      coverageData = result;

      res.json({ status: 'coverage data saved' });
    });

    this.router.get('/coverage', (req, res) => {
      const data = [];

      astData['results'].forEach(result => {
        const file = result.filePath;

        const fileCoverage = coverageData.filter(it => it.source === file);

        const cov = {
          file: file,
          methods: [],
        };

        result.result.methods.forEach(m => {
          const start = m.loc.start.line;
          const end = m.loc.end.line;

          const coveredLines = fileCoverage
            .filter(it => it.originalLine >= start && it.originalLine <= end)
            .map(it => it.hits)
            .reduce((a, b) => a + b, 0);

          cov.methods.push({
            method: m.name,
            covered: coveredLines,
          });
        });

        data.push(cov);
      });

      res.json(data);
    });
  }

  public async processCoverage(sources: any, coverage: any) {
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

      const sourceMap = this.convertRawSourceMap(rawSource);

      if (
        sourceMap == null ||
        !sourceMap.sourcemap ||
        !sourceMap.sourcemap.file.includes(scriptName)
      ) {
        console.error(`There is no source map for ${scriptName}`);
        continue;
      }
      console.log(`Script was processed ${scriptName}`);
      const cov = await this.cover(
        scriptName,
        rawSource,
        sourceMap,
        v8coverage
      );
      result.push(...cov);
    }

    return result;
  }

  public convertRawSourceMap(source: any) {
    return convertSourceMap.fromMapFileSource(source, SOURCE_MAP_FOLDER);
  }

  public async cover(
    scriptName: string,
    rawSource: any,
    sourceMap: any,
    v8coverage: any
  ) {
    const cov = await this.applyCoverage(
      `${SOURCE_MAP_FOLDER}/${scriptName}`,
      rawSource,
      sourceMap,
      v8coverage
    );

    const coverage = cov[`${SOURCE_MAP_FOLDER}/${scriptName}`];

    const fnMap = coverage.fnMap;
    const f = coverage.f;

    const func = this.convertFunctionCoverage(fnMap, f);

    return await this.applyCoverageToSourceMap(sourceMap, func);
  }

  public async applyCoverage(
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

  public convertFunctionCoverage(fnMap: object, f: any) {
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

  public async applyCoverageToSourceMap(sourceMap: any, func: any) {
    const codeMappings = await this.getMappings(sourceMap);

    return func.reduce((results: any, jsFunction: any) => {
      const fileName = this.getFileName(codeMappings, jsFunction);
      if (!fileName) {
        return results;
      }

      const mappings = this.getMappingsForFunction(
        fileName,
        codeMappings,
        jsFunction
      );

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

  public async getMappings(rawSourceMap: any) {
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

  public getFileName(codeMappings: any, jsFunction: any) {
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

  public getMappingsForFunction(
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
}
