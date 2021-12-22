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
import fsExtra from 'fs-extra';
import R from 'ramda';
import { RawSourceMap } from 'source-map';
import * as upath from 'upath';
import convertSourceMap from 'convert-source-map';
import { getDataPath } from '@util/misc';
import Logger from '@util/logger';

export async function save(
  agentId: string,
  buildVersion: string,
  sourcemaps: { sourcemap: RawSourceMap; fileName: string }[],
): Promise<void> {
  const dirPath = getSourcemapStoragePath(agentId, buildVersion);
  await fsExtra.ensureDir(dirPath);

  const logger = Logger.getLogger('agent', agentId, buildVersion);

  await Promise.all(
    sourcemaps.map(async x => {
      const { sourcemap, fileName } = x;
      // TODO add fsReplaceRestrictedCharacters(fileName)
      // once getSourceMap is fixed as well
      const fullPath = upath.join(dirPath, fileName);
      await fsExtra.writeJSON(fullPath, sourcemap);
    }),
  );

  logger.info('updating source maps...');
  if (process.env.SOURCEMAP_PREFER_FILE_FIELD) {
    logger.note('SOURCEMAP_PREFER_FILE_FIELD=true is passed. Using "file" name from sourcemap files');
  }

  // TODO move that to js-parser
  const getBundleFileName =
    process.env.SOURCEMAP_PREFER_FILE_FIELD === 'true' ? x => upath.basename(x.sourcemap.file) : x => x.fileName.replace(/\.map$/i, '');

  const scriptsNames = sourcemaps.map(
    R.pipe(
      R.tap(x => logger.note(`source map: ${x.fileName}`)),
      getBundleFileName,
      R.tap(x => logger.note(`file name : ${x}\n`)),
    ),
  );

  logger.note(
    'Tip (if you get no coverage): check that source maps match correct files in log above.' +
      '\n' +
      'If not, try changing env variable SOURCEMAP_PREFER_FILE_FIELD to either "false"/undefined or "true" ' +
      `(default = undefined, current = ${process.env.SOURCEMAP_PREFER_FILE_FIELD})`,
  );

  scriptsNames.push(null);
  if (scriptsNames.some(x => !x)) {
    const msg = 'Some script names are empty. This should not happen. Check your js-parser config or contact Drill4J development team';
    logger.error(msg);
    throw new Error(msg);
  }
  if (scriptsNames.length === 0) {
    const msg = 'No script names found. This should not happen. Check your js-parser config or contact Drill4J development team';
    logger.error(msg);
    throw new Error(msg);
  }
}

export function getSourcemapStoragePath(agentId: string, buildVersion: string): string {
  return getDataPath(agentId, buildVersion, 'source-maps');
}

// TODO use fsReplaceRestrictedCharacters
export function getSourceMap(sourceMapPath: string, source: string): RawSourceMap | null {
  return convertSourceMap.fromMapFileSource(source, sourceMapPath)?.sourcemap;
}
