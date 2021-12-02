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

import upath from 'upath';

export function getDataPath(...pathSegments: string[]): string {
  const dataFolderPath = process.env.DATA_FOLDER || 'js-agent-data';
  return upath.joinSafe(dataFolderPath, ...pathSegments.map(replaceRestrictedCharactersWith('')));
}

// Replace characters restricted for Windows OSs
// reference https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file
function replaceRestrictedCharactersWith(replacer) {
  return str => str.replace(/[/\\?%*:|"<>]/g, replacer);
}
