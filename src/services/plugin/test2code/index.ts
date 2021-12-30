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
  InitScopePayload,
  CoverDataPart,
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
import { getDataPath } from '@util/misc';
import * as sourcemapUtil from './sourcemap-util';
import { Scope, Test2CodeAction } from './types';
import * as astProcessor from './processors/ast';
import coverageProcessor from './processors/coverage';
import { formatAst } from './processors/ast';
import Plugin from '../plugin';

export class Test2CodePlugin extends Plugin {
  private activeScope: Scope;

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

  public async updateBuildInfo(buildVersion: string, buildInfo): Promise<void> {
    const { bundleFiles, data } = buildInfo;

    this.logger.info('build', buildVersion, 'saving data...');

    const dataPath = getDataPath(this.agentId, buildVersion);

    // prepare dir
    await fsExtra.remove(dataPath);
    await fsExtra.ensureDir(dataPath);

    // save data
    await fsExtra.writeJSON(`${dataPath}/bundle.json`, bundleFiles);
    await fsExtra.writeJSON(`${dataPath}/ast.json`, formatAst(data));
    this.logger.info('build', buildVersion, 'data saved!');
  }

  private async updateBundleFiles(buildVersion: string, data: { file: string; source: string; hash: string }[]): Promise<void> {
    this.logger.info('update bundle files');
    const bundlePath = this.getBundlePath(buildVersion);

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
    await storage.saveBundleMeta(this.agentId, buildVersion, meta);
  }

  private async updateAst(buildVersion, rawAst: unknown[]): Promise<void> {
    this.logger.info('update ast');
    const ast = await astProcessor.formatAst(rawAst);
    await storage.saveAst(this.agentId, buildVersion, ast);
  }

  private async updateSourceMaps(buildVersion, sourceMaps): Promise<void> {
    this.logger.info('update source maps');
    // await coverage
    await sourcemapUtil.save(this.agentId, buildVersion, sourceMaps);
  }

  private async startSession(payload: StartSessionPayload): Promise<void> {
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

  private async processCoverage(sessionId, stringifiedData): Promise<void> {
    const prepMark = global.prf.mark('prepare');
    this.logger.info('process coverage', sessionId);
    await this.ensureActiveSession(sessionId);
    try {
      const rawData = JSON.parse(stringifiedData);
      // TODO use own method "getAst" instead
      const astTree = await storage.getAst(this.agentId, this.currentBuildVersion);
      // const bundleMeta = await storage.getBundleMeta(this.agentId, this.currentBuildVersion);
      const bundleScriptsNames = await storage.getBundleScriptsNames(this.agentId, this.currentBuildVersion);
      if (!Array.isArray(bundleScriptsNames) || bundleScriptsNames.length === 0) {
        // TODO extend error and dispatch it in centralized error handler
        throw new Error('Bundle script names not found. You are probably missing source maps?');
      }
      const { data: ast } = astTree;

      const bundlePath = this.getBundlePath(this.currentBuildVersion);
      global.prf.measure(prepMark);

      const processCoverage = global.prf.mark('process');
      const data = await coverageProcessor(
        sourcemapUtil.getSourcemapStoragePath(this.agentId, this.currentBuildVersion),
        ast,
        rawData,
        bundlePath,
        // bundleMeta,
        bundleScriptsNames,
        this.cache,
      );
      global.prf.measure(processCoverage);
      global.prf.print();
      global.prf.flush();

      await this.sendTestResults(sessionId, data);
    } catch (e) {
      this.logger.warning(`failed to process coverage. Coverage data will be lost\n\tsessionId ${sessionId}\n\treason:\n\t${e?.message}`);
    }
  }

  private async finishSession(sessionId: string): Promise<void> {
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
      this.logger.warning(`failed to finish session. Session will be canceled.\n\tsessionId ${sessionId}\n\treason:\n\t${e?.message}`);
      await this.cancelSession(sessionId); // TODO that might fail as well, e.g. due to storage failure
    }
  }

  private async cancelSession(sessionId: string): Promise<void> {
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

  private async sendTestResults(sessionId, data) {
    const coverDataPartMessage: CoverDataPart = {
      type: 'COVERAGE_DATA_PART',
      sessionId,
      data,
    };
    super.send(coverDataPartMessage);
  }
}

export default Test2CodePlugin;
