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
/* eslint-disable import/no-unresolved */ // TODO configure local-module-first resolution (for development purposes)
import {
  // Models
  InitScopePayload,
  CoverDataPart,
  // Messages
  InitInfo,
  InitDataPart,
  Initialized,
  SessionStarted,
  SessionFinished,
  SessionCancelled,
  ScopeInitialized,
  StartSessionPayload,
  StopSession,
  StartSession,
  CancelSession,
  InitActiveScope,
  AddSessionData,
} from '@drill4j/test2code-types';

import fsExtra from 'fs-extra';
import * as upath from 'upath';
import * as sourcemapUtil from './sourcemap-util';
import { Scope, Test2CodeAction } from './types';
// TODO abstract ast processor, coverage processor and storage provider
import * as astProcessor from './processors/ast';
import coverageProcessor from './processors/coverage';
import storage from '../../../storage';
import { Plugin } from '..';

export class Test2CodePlugin extends Plugin {
  private activeScope: Scope;

  public async init(): Promise<void> {
    this.logger.info('init');
    // this.initialized = true;
    // starts test2code initialization (gotta send InitDataPart message to complete it)
    const initInfoMessage: InitInfo = {
      type: 'INIT',
      // classesCount - legacy parameter from Java agent implementation, expected to send actuall class count
      // js introduces lots of differences such as:
      //  - multiple classes per file
      //  - functions instead of classes
      // it is set to 0 for the time being
      classesCount: 0,
      message: `Initializing plugin ${this.id}`,
      init: true,
    };
    super.send(initInfoMessage);

    const ast = await this.getAst();
    // sends AST
    //    non-Java agent AST initialization
    //    it is workaround due to legacy reasons
    //    it differs from Java agent's implementation (you won't find INIT_DATA_PART in java agent sourcecode)
    const initDataPartMessage: InitDataPart = {
      type: 'INIT_DATA_PART',
      astEntities: astProcessor.formatForBackend(ast),
    };
    super.send(initDataPartMessage);

    // "launches" test2code plugin with AST & params prepared beforehand
    const initializedMessage: Initialized = { type: 'INITIALIZED', msg: '' };
    super.send(initializedMessage);

    // TODO memorize "agentId - initiated plugin" to define if
    this.logger.debug('init: done');
  }

  public async stop(): Promise<void> {
    this.logger.info('stop\n   (it is a stub method, does not do anything yet)');
  }

  public async handleAction(action: unknown): Promise<void> {
    switch ((action as Test2CodeAction).type) {
      case 'INIT_ACTIVE_SCOPE':
        await this.setActiveScope((action as InitActiveScope).payload);
        break;

      case 'START_AGENT_SESSION':
        await this.startSession((action as StartSession).payload);
        break;

      case 'STOP':
        await this.finishSession((action as StopSession).payload.sessionId);
        break;

      case 'CANCEL':
        await this.cancelSession((action as CancelSession).payload.sessionId);
        break;

      case 'ADD_SESSION_DATA':
        await this.processCoverage((action as AddSessionData).payload.sessionId, (action as AddSessionData).payload.data);
        break;

      default:
        this.logger.debug('received unknown action %o', action);
        break;
    }
  }

  private async getAst() {
    const ast = await storage.getAst(this.agentId);
    return ast && ast.data;
  }

  private async setActiveScope(payload: InitScopePayload) {
    this.logger.info('init active scope %o', payload);
    const { id, name, prevId } = payload;
    this.activeScope = {
      id,
      name,
      prevId,
      ts: Date.now(),
    };
    await storage.deleteSessions(this.agentId); // TODO might wanna store active scope ID and delete/cancel sessions based on prevId

    const scopeInitializedMessage: ScopeInitialized = {
      type: 'SCOPE_INITIALIZED',
      ...this.activeScope,
    };
    super.send(scopeInitializedMessage);
  }

  public async updateBuildInfo(buildInfo): Promise<void> {
    const { bundleFiles, sourcemaps, data } = buildInfo;
    // TODO transaction
    await this.updateAst(data);
    await this.updateBundleFiles(bundleFiles);
    await this.updateSourceMaps(sourcemaps);
  }

  private getBundlePath() {
    const bundlesDir = process.env.BUNDLES_FOLDER || 'bundles';
    return upath.join(bundlesDir, this.agentId);
  }

  public async updateBundleFiles(data: { file: string; source: string; hash: string }[]): Promise<void> {
    this.logger.info('update bundle files');
    const bundlePath = this.getBundlePath();

    await fsExtra.remove(bundlePath);
    await fsExtra.ensureDir(bundlePath);
    const meta = await Promise.all(
      data.map(async x => {
        const fileName = upath.join(bundlePath, upath.basename(x.file));
        await fsExtra.writeFile(fileName, x.source);
        return {
          file: x.file,
          hash: x.hash,
        };
      }),
    );
    // TODO save bundle hashes info with scriptnames from sourcemaps
    await storage.saveBundleMeta(this.agentId, meta);
  }

  public async updateAst(rawAst: unknown[]): Promise<void> {
    this.logger.info('update ast');
    const ast = await astProcessor.formatAst(rawAst); // TODO abstract AST processor
    await storage.saveAst(this.agentId, ast); // TODO abstract storage
  }

  public async updateSourceMaps(sourceMaps): Promise<void> {
    this.logger.info('update source maps');
    // await coverage
    await sourcemapUtil.save(this.agentId, sourceMaps);
  }

  public async startSession(payload: StartSessionPayload): Promise<void> {
    this.logger.info('start session', JSON.stringify(payload));
    const { testType, sessionId } = payload;
    await storage.saveSession(this.agentId, sessionId, payload);

    const sessionStartedMessage: SessionStarted = {
      type: 'SESSION_STARTED',
      sessionId,
      testType,
      ts: Date.now(),
    };

    super.send(sessionStartedMessage);
  }

  async processCoverage(sessionId, stringifiedData): Promise<void> {
    this.logger.info('process coverage', sessionId);
    await this.ensureActiveSession(sessionId);
    try {
      const rawData = JSON.parse(stringifiedData);
      const astTree = await storage.getAst(this.agentId);
      const bundleMeta = await storage.getBundleMeta(this.agentId);
      const bundleScriptsNames = await storage.getBundleScriptsNames(this.agentId);

      if (!Array.isArray(bundleScriptsNames) || bundleScriptsNames.length === 0) {
        // TODO extend error and dispatch it in centralized error handler
        throw new Error('Bundle script names not found. You are probably missing source maps?');
      }
      const { data: ast } = astTree;

      const bundlePath = this.getBundlePath();
      const data = await coverageProcessor(
        `${sourcemapUtil.sourceMapFolder}${upath.sep}${this.agentId}`,
        ast,
        rawData,
        bundlePath,
        bundleMeta,
        bundleScriptsNames,
      );

      await this.sendTestResults(sessionId, data);
    } catch (e) {
      this.logger.warning(`failed to process coverage. Coverage data will be lost\n\tsessionId ${sessionId}\n\treason:\n\t${e.message}`);
    }
  }

  public async finishSession(sessionId: string): Promise<void> {
    this.logger.info('finish session', sessionId);
    await this.ensureActiveSession(sessionId);
    try {
      await storage.removeSession(this.agentId, sessionId);
      const sessionFinishedMessage: SessionFinished = {
        type: 'SESSION_FINISHED',
        sessionId,
        ts: Date.now(),
      };

      super.send(sessionFinishedMessage);
    } catch (e) {
      this.logger.warning(`failed to finish session. Session will be canceled.\n\tsessionId ${sessionId}\n\treason:\n\t${e.message}`);
      await this.cancelSession(sessionId); // TODO that might fail as well, e.g. due to storage failure
    }
  }

  public async cancelSession(sessionId: string): Promise<void> {
    this.logger.info('cancel session', sessionId);
    await storage.removeSession(this.agentId, sessionId);
    const sessionCanceledMessage: SessionCancelled = {
      type: 'SESSION_CANCELLED',
      sessionId,
      ts: Date.now(),
    };

    super.send(sessionCanceledMessage);
  }

  private async ensureActiveSession(sessionId): Promise<any> {
    const session = await storage.getSession(this.agentId, sessionId);
    if (!session) {
      throw new Error(`Session with id ${sessionId} not found!`);
    }
    return session;
  }

  async sendTestResults(sessionId, data) {
    const coverDataPartMessage: CoverDataPart = {
      type: 'COVERAGE_DATA_PART',
      sessionId,
      data,
    };
    super.send(coverDataPartMessage);
  }
}

export default Test2CodePlugin;
