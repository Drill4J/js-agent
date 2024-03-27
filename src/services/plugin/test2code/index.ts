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
/* eslint-disable import/no-unresolved */
import { ExecClassData } from '@drill4j/test2code-types';

import fsExtra from 'fs-extra';
import { getDataPath } from '@util/misc';
import coverageProcessor from './processors/coverage';
import { formatAst } from './processors/ast';
import { ILoggerProvider } from '@util/logger';
import { AgentKey } from 'app.types';

export class Test2CodePlugin {
  private logger: any;

  constructor(agentKey: AgentKey, loggerProvider: ILoggerProvider) {
    this.logger = loggerProvider.getLogger('build', agentKey);
  }

  private cache: Record<string, any> = {};

  public async convertV8Coverage(agentKey: AgentKey, data: string, sessionId: string): Promise<ExecClassData[]> {
    const rawData = JSON.parse(data);
    // TODO get rid of monkeypatching once we'll remove sessionId
    rawData.sessionId = sessionId;
    return this.processCoverage(agentKey, rawData);
  }

  public async saveBuildMetadata(agentKey: AgentKey, buildInfo): Promise<void> {
    const { bundleFiles, data, config } = buildInfo;

    this.logger.info(agentKey, 'saving data...');

    const dataPath = getDataPath(agentKey);

    // prepare dir
    await fsExtra.remove(dataPath);
    await fsExtra.ensureDir(dataPath);

    // save data
    await fsExtra.writeJSON(`${dataPath}/bundle.json`, bundleFiles);
    await fsExtra.writeJSON(`${dataPath}/ast.json`, formatAst(data));
    await fsExtra.writeJSON(`${dataPath}/config.json`, config);
    this.logger.info(agentKey, 'data saved!');
  }

  private async processCoverage(agentKey: AgentKey, rawData: any): Promise<any> {
    const perfMark1 = global.prf.mark('prepare');
    const dataPath = getDataPath(agentKey);
    const sourceAst = await fsExtra.readJSON(`${dataPath}/ast.json`);
    const bundleData = await fsExtra.readJSON(`${dataPath}/bundle.json`);
    const config = await fsExtra.readJSON(`${dataPath}/config.json`);
    global.prf.measure(perfMark1);

    const perfMark2 = global.prf.mark('process');
    const data = await coverageProcessor(sourceAst, bundleData, rawData, this.cache, config.projectPaths);
    global.prf.measure(perfMark2);

    global.prf.print();
    global.prf.flush();
    return data;
  }
}

export default Test2CodePlugin;
