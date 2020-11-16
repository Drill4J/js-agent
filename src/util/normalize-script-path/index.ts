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
import * as upath from 'upath';

export default function normalizePath(path: string): string {
  // .toUnix is required, because .normalize fallbacks to regular path.normalize when ran in Jest
  // reference https://github.com/facebook/jest/issues/9360
  return upath.toUnix(upath.normalize(path)).replace(/^\W+/, '');
}
