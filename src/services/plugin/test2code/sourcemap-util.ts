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
import { RawSourceMap } from 'source-map';
import * as upath from 'upath';
import storage from '../../../storage';
import Logger from '../../../util/logger';

const logger = Logger.getLogger('drill', 'sourcemap-util');

export const sourceMapFolder = process.env.SOURCE_MAP_FOLDER || './sourceMaps';

export async function save(agentId: string, sourcemaps: { sourcemap: RawSourceMap; fileName: string }[]): Promise<void> {
  const dirPath = `${sourceMapFolder}${upath.sep}${agentId}`;
  await fsExtra.ensureDir(dirPath);

  await Promise.all(
    sourcemaps.map(async x => {
      const { sourcemap, fileName } = x;
      const fullPath = upath.join(dirPath, fileName);
      await fsExtra.writeJSON(fullPath, sourcemap);
    }),
  );

  const scriptsNames = sourcemaps
    .map(x => {
      if (x.sourcemap.file) {
        return upath.basename(x.sourcemap.file);
      }
      if (x.fileName) {
        logger.warning(
          `no "file" field found in source map.
          \n\tTrimming the ".map" suffix from the sourcemap name "${x.fileName}" to infere the related file name`,
        );
        const regex = /\.map$/i;
        return x.fileName.replace(regex, '');
      }
      return null;
    })
    .filter(x => !!x);

  if (scriptsNames.length === 0) {
    logger.error(`failed to match sourcemap with any bundle file: no "file" field or the respective file name is found.\n
    Check source map generation or JS AST Parser CLI config to fix the issue`);
  }

  await storage.saveBundleScriptsNames(agentId, scriptsNames);
}
