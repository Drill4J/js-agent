/* eslint-disable import/no-unresolved */
import { ExecClassData } from '@drill4j/test2code-types';
import chalk from 'chalk';
import convertSourceMap from 'convert-source-map';
import crypto from 'crypto';
import fsExtra from 'fs-extra';
import { SourceMapConsumer } from 'source-map';
import * as upath from 'upath';
import Source from './lib/source';
import storage from '../../../../../storage';
import LoggerProvider from '../../../../../util/logger';
import normalizeScriptPath from '../../../../../util/normalize-script-path';

import { Range } from './types';

const logger = LoggerProvider.getLogger('drill', 'coverage-processor');
const sourceMapFolder = process.env.SOURCE_MAP_FOLDER || './sourceMaps';

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
    const rangesCoveredByTest = getRangesCoveredByTest(coverage, astMethod, filePath);

    const linesCoveredByTest = []; // TODO check for rangesCOveredByTest > 0 ?
    rangesCoveredByTest.forEach(range => {
      // eslint-disable-next-line no-plusplus
      for (let line = range.startLine; line <= range.endLine; line++) {
        linesCoveredByTest.push(line);
      }
    });

    const newMethod = {
      method: astMethod.name,
      probes: astMethod.probes,
      coveredLines: linesCoveredByTest,
    };

    return newMethod;
  });

  return result;
}

function getRangesCoveredByTest(rangeCoverage, astMethod, filePath) {
  return rangeCoverage
    .filter(x =>
      filePath.includes(normalizeScriptPath(x.source)) &&
      astMethod.probes.includes(x.startLine) && astMethod.probes.includes(x.endLine));
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
      continue; // TODO warning if no coverage was processed at all (all filtered, including continue; statements bellow)
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
    const scriptHash = getHash(unifyLineEndings(script.source));
    const isSameBundle = bundleHashes.findIndex(({ file, hash }) => file.includes(scriptName) && scriptHash === hash) > -1;
    if (!isSameBundle) throw new Error(`coverage processing: bundle hash mismatch for script ${url}`);
    // TODO process.env.DUMP_SOURCE_ON_HASH_MISMATCH

    const rawSource = script.source;
    const v8coverage = element.functions;

    if (url === process.env.DEBUG_TARGET_SCRIPT_URL) {
      printRangeCoverage(rawSource, v8coverage);
    }

    const sourceMap = convertSourceMap.fromMapFileSource(rawSource, `${sourceMapFolder}${upath.sep}${agentId}`);

    if (
      sourceMap == null ||
      !sourceMap.sourcemap ||
      !sourceMap.sourcemap.file.includes(scriptName)
    ) {
      logger.error(`there is no source map for ${scriptName}`);
      continue;
    }

    logger.debug(`script was processed ${scriptName}`);
    const consecutiveRanges = convertFromOverlappingToConsecutiveRanges(v8coverage);
    const coveredRanges = await mapGeneratedOffsetsOntoOriginalLines(rawSource, sourceMap, consecutiveRanges);
    result.push(...coveredRanges);
  }

  return result;
}

function getHash(data) {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

function unifyLineEndings(str: string): string {
  // reference https://www.ecma-international.org/ecma-262/10.0/#sec-line-terminators
  const LF = '\u000A';
  const CRLF = '\u000D\u000A';
  const LS = '\u2028';
  const PS = '\u2028';
  return str.replace(RegExp(`(${CRLF}|${LS}|${PS})`, 'g'), LF);
}

/*
*  For a reference see https://v8.dev/blog/javascript-code-coverage#for-embedders
*
*  Pay attention to exact range positions in function objects.
*  For each function:
*  - ranges with index > 0 overlap Range 0;
*  - essentially Range 0 is a "base" that marks the whole function as "covered";
*  - and all ranges with index > 0 exclude certain parts from Range 0, marking those as "not-covered".
*
*  Ranges are converted for the whole script at once because some functions have overlapping ranges.
*  E.g.:
*  function parent (arr) {
*    var str = arr
*        .map(function (x, i) { // callback produces separate function object in v8 report, but it's ranges overlap parent function
*        return "el #" + i;
*    })
*  };
*/
function convertFromOverlappingToConsecutiveRanges(v8coverage: any) {
  let consecutiveRanges = [];
  v8coverage.forEach(fn => {
    fn.ranges.forEach(range => {
      consecutiveRanges = mergeRange(consecutiveRanges, range);
    });
  });
  return consecutiveRanges;
}

function mergeRange(consecutiveRanges: Range[], newRange: Range) {
  const rangesToInsert: Range[] = [newRange];
  if (consecutiveRanges.length === 0) {
    return rangesToInsert;
  }

  const intersectionIndex = consecutiveRanges.findIndex(range =>
    (range.startOffset <= newRange.startOffset &&
      range.endOffset >= newRange.endOffset));

  if (intersectionIndex === -1) {
    const rightNeighboringRange = consecutiveRanges.findIndex(range => range.startOffset >= newRange.endOffset) > -1;
    if (rightNeighboringRange) {
      return [newRange, ...consecutiveRanges];
    }
    return [...consecutiveRanges, newRange];
  }

  const intersectedRange = consecutiveRanges[intersectionIndex];

  const touchStart = intersectedRange.startOffset === newRange.startOffset;
  const touchEnd = intersectedRange.endOffset === newRange.endOffset;
  if (touchStart) {
    rangesToInsert.push({
      startOffset: newRange.endOffset,
      endOffset: intersectedRange.endOffset,
      count: intersectedRange.count,
    });
  } else if (touchEnd) {
    rangesToInsert.unshift({
      startOffset: intersectedRange.startOffset,
      endOffset: newRange.startOffset,
      count: intersectedRange.count,
    });
  } else { // newRange is completely nested inside intersectedRange
    rangesToInsert.push({
      startOffset: newRange.endOffset,
      endOffset: intersectedRange.endOffset,
      count: intersectedRange.count,
    });
    rangesToInsert.unshift({
      startOffset: intersectedRange.startOffset,
      endOffset: newRange.startOffset,
      count: intersectedRange.count,
    });
  }

  const resultingRanges = [...consecutiveRanges];
  resultingRanges.splice(intersectionIndex, 1, ...rangesToInsert);
  return resultingRanges;
}

async function mapGeneratedOffsetsOntoOriginalLines(rawSource, sourceMap, consecutiveRanges) {
  const source = new Source(rawSource, null);
  const sourcemapConsumer = await new SourceMapConsumer(sourceMap.sourcemap);
  const convertedCoverage = consecutiveRanges
    .map((range) => {
      const rangeString = rawSource.substring(range.startOffset, range.endOffset);
      if (!rangeString.trim()) return null; // ignore range if it contains only whitespaces, tabs and newlines

      const leadingWhitespacesCount = rangeString.length - rangeString.trimLeft().length;
      const trailingWhitespacesCount = rangeString.length - rangeString.trimRight().length;

      // ignore whitespace coverage
      const startOffset = leadingWhitespacesCount > 0 ? range.startOffset + leadingWhitespacesCount : range.startOffset;
      const endOffset = trailingWhitespacesCount > 0 ? range.endOffset - trailingWhitespacesCount : range.endOffset;

      const originalPosition = source.offsetToOriginalRelative(sourcemapConsumer, startOffset, endOffset);
      const rangeNotInOriginalSource = Object.keys(originalPosition).length === 0;
      if (rangeNotInOriginalSource) return null;
      return {
        ...originalPosition,
        count: range.count,
      };
    })
    // filter ranges not present in the original source files
    // e.g. ranges corresponding to boilerplate code produced at file concatenation phase in the build pipeline
    // filter not-covered ranges
    .filter(range => range && range.count > 0);
  sourcemapConsumer.destroy();
  return convertedCoverage;
}

function printRangeCoverage(rawSource: any, v8coverage: any) {
  const raw = rawSource;
  let highlightedSource = '';
  /* eslint-disable no-plusplus */
  for (let offset = 0; offset < raw.length; offset++) {
    const symbol = raw[offset];
    let toAppend = symbol;
    v8coverage.forEach(fn => {
      fn.ranges.filter(range => range.startOffset <= offset && range.endOffset >= offset).forEach(range => {
        if (range.count === 0) {
          toAppend = chalk.bgRed.black(symbol);
        } else if (range.count === 1) {
          toAppend = chalk.bgGreen.black(symbol);
        } else if (range.count === 2) {
          toAppend = chalk.bgBlue.black(symbol);
        } else if (range.count > 2) {
          toAppend = chalk.bgYellow.black(symbol);
        }
      });
    });

    highlightedSource += toAppend;
  }
  const highlightedLines = highlightedSource.replace(/\r?\n/g, '\n').split('\n');
  highlightedLines.forEach(x => console.log(x));
}
