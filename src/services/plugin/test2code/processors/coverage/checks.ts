/*
 * Copyright 2020 EPAM Systems
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import crypto from 'crypto';
import { BundleHashes, ScriptSources, ScriptUrl, V8ScriptCoverage } from './types';
import { extractScriptNameFromUrl } from './util';
import LoggerProvider from '../../../../../util/logger';

const logger = LoggerProvider.getLogger('drill', 'coverage-processor');

export function checkScriptNames(v8ScriptCoverage: V8ScriptCoverage, scriptNames: string[]): boolean {
  const { url } = v8ScriptCoverage;
  const scriptName = extractScriptNameFromUrl(url);
  const scriptNameMatch = scriptName && scriptNames.some(it => it.includes(scriptName));
  if (!scriptNameMatch) {
    logger.silly(`script was filtered ${scriptName}`);
  }
  return scriptNameMatch;
}

export function checkSameBundle(url: ScriptUrl, sources: ScriptSources, bundleHashes: BundleHashes): boolean {
  const script = sources[url];
  if (!script) {
    logger.warning(`bundle check: unknown script: ${url}`);
    return false;
  }
  const scriptHash = getHash(unifyLineEndings(script.source));
  const scriptName = extractScriptNameFromUrl(url);
  const isSameBundle = bundleHashes.findIndex(({ file, hash }) => file.includes(scriptName) && scriptHash === hash) > -1;
  if (!isSameBundle) {
    logger.warning(`bundle check: hash mismatch for script: ${url}`);
  }
  return isSameBundle;
}

function getHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function unifyLineEndings(str: string): string {
  // reference https://www.ecma-international.org/ecma-262/10.0/#sec-line-terminators
  const LF = '\u000A';
  const CRLF = '\u000D\u000A';
  const LS = '\u2028';
  const PS = '\u2029';
  return str.replace(RegExp(`(${CRLF}|${LS}|${PS})`, 'g'), LF);
}
