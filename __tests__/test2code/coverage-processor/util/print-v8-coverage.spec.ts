import deepFreeze from 'js-flock/deepFreeze';
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
import { ScriptSources, Test, V8Coverage } from '../../../../src/services/plugin/test2code/processors/coverage/types';
import { printV8Coverage } from '../../../../src/services/plugin/test2code/processors/coverage/util';
import mutationErrorsMatcher from '../../../__util__/mutation-errors-matcher';
import args from '../__fixtures__/coverage-processor-args.json';

let suppressedLog;
beforeEach(() => {
  suppressedLog = jest.spyOn(console, 'log').mockImplementation(() => {});
});
it('must not mutate inputs', () => {
  try {
    const { coverage, scriptSources } = (args[2] as unknown) as { coverage: V8Coverage; scriptSources: ScriptSources };
    // TODO deepFreeze freezes args instance, meaning other tests will get frozen object as well!
    const frozenCoverage = deepFreeze(coverage) as V8Coverage;
    const frozenScriptSources = deepFreeze(scriptSources) as ScriptSources;
    printV8Coverage(frozenCoverage, frozenScriptSources, 'http://localhost:8081/js/Application.js');
  } catch (e) {
    expect(e).not.toEqual(mutationErrorsMatcher);
  }
});
it('must not throw', () => {
  const { coverage, scriptSources } = (args[2] as unknown) as { coverage: V8Coverage; scriptSources: ScriptSources };
  expect(() => printV8Coverage(coverage, scriptSources, 'http://localhost:8081/js/Application.js')).not.toThrow();
});
afterEach(() => {
  suppressedLog.mockRestore();
});
