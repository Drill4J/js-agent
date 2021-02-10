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
// import deepFreeze from 'js-flock/deepFreeze';
// import coverageProcessor from '../../../src/services/plugin/test2code/processors/coverage';
// import {
//   AstEntity,
//   BundleHashes,
//   BundleScriptNames,
//   ScriptSources,
//   TestName,
//   TestType,
//   V8Coverage,
// } from '../../../src/services/plugin/test2code/processors/coverage/types';
// import mutationErrorsMatcher from '../../__util__/mutation-errors-matcher';
// import args from './__fixtures__/coverage-processor-args.json';

// // TODO fix tests
// it('must match snapshot', async () => {
//   const [sourcemapPath, astEntities, rawData, bundleHashes, bundleScriptNames] = args as Array<unknown>;
//   const data = await coverageProcessor(
//     sourcemapPath as string,
//     astEntities as AstEntity[],
//     rawData as { coverage: V8Coverage; scriptSources: ScriptSources },
//     { testName: 'add', testType: 'MANUAL' } as { testName: TestName; testType: TestType },
//     bundleHashes as BundleHashes,
//     bundleScriptNames as BundleScriptNames,
//   );
//   expect(data).toMatchSnapshot();
// });

// it('must not mutate input', async () => {
//   try {
//     // TODO deepFreeze freezes args instance, meaning other tests will get frozen object as well!
//     const [sourcemapPath, astEntities, rawData, bundleHashes, bundleScriptNames] = deepFreeze(args) as Array<unknown>;
//     await coverageProcessor(
//       sourcemapPath as string,
//       astEntities as AstEntity[],
//       rawData as { coverage: V8Coverage; scriptSources: ScriptSources },
//       { testName: 'add', testType: 'MANUAL' } as { testName: TestName; testType: TestType },
//       bundleHashes as BundleHashes,
//       bundleScriptNames as BundleScriptNames,
//     );
//   } catch (e) {
//     expect(e).not.toEqual(mutationErrorsMatcher);
//   }
// });
