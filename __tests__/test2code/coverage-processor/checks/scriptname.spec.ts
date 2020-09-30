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
import { checkScriptNames } from '../../../../src/services/plugin/test2code/processors/coverage/checks';
import { ScriptUrl, V8ScriptCoverage } from '../../../../src/services/plugin/test2code/processors/coverage/types';

describe('script name check ran', () => {
  it('on script listed in scriptnames array must return true', async () => {
    const scriptListed: V8ScriptCoverage = {
      functions: [],
      url: 'http://localhost:8081/js/Application.js' as ScriptUrl,
    };
    const result = checkScriptNames(scriptListed, ['Application.js']);
    expect(result).toEqual(true);
  });
  it('on script not from scriptnames array must return false', async () => {
    const scriptNotListed: V8ScriptCoverage = {
      functions: [],
      url: 'http://localhost:8081/node_modules/angular/angular.js' as ScriptUrl,
    };
    const result = checkScriptNames(scriptNotListed, ['Application.js']);
    expect(result).toEqual(false);
  });
});
