/* eslint-disable import/no-unresolved */ // TODO configure local-module-first resolution (for development purposes)
import {
  // Models
  AstEntity,
  InitScopePayload,
  CoverDataPart,
  // Actions
  InitActiveScope,
  // Messages
  InitInfo,
  InitDataPart,
  Initialized,
  SessionStarted,
  SessionFinished,
  SessionCancelled,
  ScopeInitialized,
  ScopeSummary,
} from '@drill4j/test2code-types';

import { Scope } from './types';

// TODO abstract ast processor, coverage processor and storage provider
import * as astProcessor from './processors/ast';
import * as coverageProcessor from './processors/coverage';
import storage from '../../../storage';
import { Plugin } from '..';

export class Test2CodePlugin extends Plugin {
  private activeScope: Scope;

  public async init() {
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

  public handleAction(action) {
    this.logger.silly('handle action %o', action);
    if (this.isInitActiveScopeAction(action)) {
      this.setActiveScope(action.payload);
      return;
    }
    this.logger.debug('received unknown action %o', action);
  }

  private async getAst() {
    const ast = await storage.getAst(this.agentId);
    return ast && ast.data;
  }

  private setActiveScope(payload: InitScopePayload) {
    this.logger.info('init active scope %o', payload);
    const { id, name, prevId } = payload;
    this.activeScope = {
      id,
      name,
      prevId,
      ts: Date.now(),
    };
    storage.deleteSessions(this.agentId); // TODO might wanna store active scope ID and delete/cancel sessions based on prevId

    const scopeInitializedMessage: ScopeInitialized = {
      type: 'SCOPE_INITIALIZED',
      ...this.activeScope,
    };
    super.send(scopeInitializedMessage);
  }

  isInitActiveScopeAction(action: InitActiveScope): action is InitActiveScope {
    return (action as InitActiveScope).type === 'INIT_ACTIVE_SCOPE';
  }

  public async updateBuildInfo(buildInfo): Promise<void> {
    const { bundleHashes, sourcemaps, data } = buildInfo;
    // TODO transaction
    await this.updateAst(data);
    await this.updateBundleHashes(bundleHashes);
    await this.updateSourceMaps(sourcemaps);
  }

  public async updateBundleHashes(data: { file: string; hash: string }[]): Promise<void> {
    this.logger.info('update bundle hashes');
    await storage.saveBundleHashes(this.agentId, data);
  }

  public async updateAst(rawAst: unknown[]): Promise<void> {
    this.logger.info('update ast');
    const ast = await astProcessor.formatAst(rawAst); // TODO abstract AST processor
    await storage.saveAst(this.agentId, ast); // TODO abstract storage
  }

  public async updateSourceMaps(sourceMaps): Promise<void> {
    this.logger.info('update source maps');
    // await coverage
    await coverageProcessor.saveSourceMaps(this.agentId, sourceMaps);
  }

  public async startSession(sessionId): Promise<void> {
    this.logger.info('start session', sessionId);
    await storage.saveSession(this.agentId, sessionId);

    const sessionStartedMessage: SessionStarted = {
      type: 'SESSION_STARTED',
      sessionId,
      testType: 'MANUAL', // TODO send actuall test type, dont just send 'MANUAL'
      ts: 0,
    };

    super.send(sessionStartedMessage);
  }

  public async finishSession(sessionId: string, rawData): Promise<void> {
    this.logger.info('process coverage and finish session', sessionId);
    await this.ensureActiveSession(sessionId);
    try {
      const astTree = await storage.getAst(this.agentId);
      const bundleHashes = await storage.getBundleHashes(this.agentId);
      const { data: ast } = astTree;

      const data = await coverageProcessor.processTestResults(this.agentId, ast, rawData, bundleHashes);
      await this.sendTestResults(sessionId, data);

      await storage.removeSession(this.agentId, sessionId);
      const sessionFinishedMessage: SessionFinished = {
        type: 'SESSION_FINISHED',
        sessionId,
        ts: 0,
      };

      super.send(sessionFinishedMessage);
    } catch (e) {
      this.logger.warning(`failed to finish session. Session will be canceled. \n\tsessionId ${sessionId}\n\treason:\n\t${e.message}`);
      this.cancelSession(sessionId);
    }
  }

  public async cancelSession(sessionId: string): Promise<void> {
    await storage.removeSession(this.agentId, sessionId);
    const sessionCanceledMessage: SessionCancelled = {
      type: 'SESSION_CANCELLED',
      sessionId,
      ts: 0,
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
