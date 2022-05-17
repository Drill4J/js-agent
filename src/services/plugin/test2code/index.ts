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
import {
  CoverDataPart,
  InitInfo,
  InitDataPart,
  Initialized,
  SessionStarted,
  SessionFinished,
  SessionCancelled,
  ScopeInitialized,
  StopSession,
  StartSession,
  CancelSession,
  InitActiveScope,
  AddSessionData,
} from '@drill4j/test2code-types';

import fsExtra from 'fs-extra';
import * as upath from 'upath';
import { getDataPath } from '@util/misc';
import { Test2CodeAction } from './types';
import * as astProcessor from './processors/ast';
import coverageProcessor from './processors/coverage';
import { formatAst } from './processors/ast';
import Plugin from '../plugin';

export class Test2CodePlugin extends Plugin {
  private cache: Record<string, any> = {};

  public async init(): Promise<void> {
    this.logger.info('init');

    // classesCount: 0 - legacy param from Java agent implementation
    super.send<InitInfo>({ type: 'INIT', classesCount: 0, message: `Initializing plugin ${this.id}`, init: true });

    const dataPath = getDataPath(this.agentId, this.currentBuildVersion);
    const sourceAst = await fsExtra.readJSON(`${dataPath}/ast.json`);
    super.send<InitDataPart>({
      type: 'INIT_DATA_PART',
      astEntities: astProcessor.formatForBackend(sourceAst),
    });

    super.send<Initialized>({ type: 'INITIALIZED', msg: '' });

    this.logger.debug('init: done');
  }

  // required for coverage highlight in vscode extension
  public async getAst(buildVersion: string) {
    const dataPath = getDataPath(this.agentId, buildVersion);
    let ast;
    try {
      ast = await fsExtra.readJSON(`${dataPath}/ast.json`);
    } catch (e) {
      throw new Error(`Failed to obtain AST data. Reason: ${e.message}`);
    }
    return ast;
  }

  public async handleAction(action: unknown): Promise<void> {
    switch ((action as Test2CodeAction).type) {
      // #region Handlers added for Admin Backend API compatibility / do not actually call/modify anything
      case 'INIT_ACTIVE_SCOPE': {
        const { id, name, prevId } = (action as InitActiveScope).payload;
        this.logger.info('init active scope', id);
        super.send<ScopeInitialized>({
          type: 'SCOPE_INITIALIZED',
          id,
          name,
          prevId,
          ts: Date.now(),
        });
        break;
      }

      case 'START_AGENT_SESSION': {
        const { testType, sessionId } = (action as StartSession).payload;
        this.logger.info('start session', sessionId);
        super.send<SessionStarted>({ type: 'SESSION_STARTED', sessionId, testType, ts: Date.now() });
        break;
      }

      case 'STOP': {
        const { sessionId } = (action as StopSession).payload;
        this.logger.info('finish session', sessionId);

        super.send<SessionFinished>({
          type: 'SESSION_FINISHED',
          sessionId,
          ts: Date.now(),
        });
        break;
      }

      case 'CANCEL': {
        const { sessionId } = (action as CancelSession).payload;
        this.logger.info('cancel session', sessionId);
        super.send<SessionCancelled>({
          type: 'SESSION_CANCELLED',
          sessionId,
          ts: Date.now(),
        });
        break;
      }
      // #endregion

      case 'ADD_SESSION_DATA': {
        const { data, sessionId } = (action as AddSessionData).payload;
        this.logger.info('process coverage', sessionId);
        try {
          const rawData = JSON.parse(data);
          const coverage = await this.processCoverage(rawData);
          super.send<CoverDataPart>({
            type: 'COVERAGE_DATA_PART',
            sessionId,
            data: coverage,
          });
        } catch (e) {
          this.logger.warning(
            `failed to process coverage. Coverage data will be lost\n\tsessionId ${sessionId}\n\treason:\n\t${e?.message}\n${e?.stack}`,
          );
        }
        break;
      }

      default:
        this.logger.debug('received unknown action %o', action);
        break;
    }
  }

  public async updateBuildInfo(buildVersion: string, buildInfo): Promise<void> {
    const { bundleFiles, data, config } = buildInfo;

    this.logger.info('build', buildVersion, 'saving data...');

    const dataPath = getDataPath(this.agentId, buildVersion);

    // prepare dir
    await fsExtra.remove(dataPath);
    await fsExtra.ensureDir(dataPath);

    // save data
    await fsExtra.writeJSON(`${dataPath}/bundle.json`, bundleFiles);
    await fsExtra.writeJSON(`${dataPath}/ast.json`, formatAst(data));
    await fsExtra.writeJSON(`${dataPath}/config.json`, config);
    this.logger.info('build', buildVersion, 'data saved!');
  }

  private async processCoverage(rawData): Promise<any> {
    const perfMark1 = global.prf.mark('prepare');
    const dataPath = getDataPath(this.agentId, this.currentBuildVersion);
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
