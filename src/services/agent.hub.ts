/* eslint-disable max-classes-per-file */

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
  ScopeInitialized,
  ScopeSummary,
} from '@drill4j/test2code-types';

// TODO abstract ast processor, coverage processor and storage provider
import * as astService from './ast.service';
import * as coverageService from './coverage.service';
import storage from '../storage';

import { ILoggerProvider } from '../util/logger';

export class AgentHub {
  private config: AgentHubConfig;

  private agentsDataStorage: AgentsDataStorage;

  private AgentConnectionProvider: ConnectionProvider;

  private logger: any;

  private agents: AgentsMap = {};

  public initialized: boolean;

  public initializing: Promise<any>;

  // TODO choose suitable dependency injection plugin to avoid passing logger via config
  constructor(agentsDataStorage: AgentsDataStorage, agentConnectionProvider: ConnectionProvider, config: AgentHubConfig) {
    this.agentsDataStorage = agentsDataStorage;
    this.AgentConnectionProvider = agentConnectionProvider;
    this.config = config;
    this.logger = this.config.loggerProvider.getLogger('drill', 'agenthub');
    this.initializing = this.init();
  }

  private async init(): Promise<void> {
    this.logger.info('init');
    await this.initAgents();
    this.initialized = true;
    this.logger.debug('init: done');
  }

  private async initAgents(): Promise<void> {
    this.logger.info('init agents');
    const agentsData = await this.agentsDataStorage.getAgentsData();
    const agentsInitializing = agentsData.map((agentData: AgentData) => this.startAgent(agentData));
    await Promise.all(agentsInitializing);
  }

  public async startAgent(agentData: AgentData, isNew = false): Promise<void> {
    this.logger.info('start agent:', agentData.id);
    // TODO what if agent already started?

    const availablePlugins: AvailablePlugins = {
      test2code: Test2CodePlugin, // TODO there must be a way to resolve that with type system instead of hardcoded key
    };

    const agentConfig: AgentConfig = {
      loggerProvider: this.config.loggerProvider,
      connection: this.config.agent.connection,
      messageParseFunction: parseJsonRecursive,
      availablePlugins,
    };

    const agent = new Agent(agentData, this.AgentConnectionProvider, agentConfig, isNew); // TODO figure out needSync
    this.agents[agent.id] = agent;
    await agent.initializing;
  }

  public async registerAgent(agentData: AgentData): Promise<void> {
    this.logger.info('register agent %o', agentData);
    // TODO what if agent already registered?
    await this.agentsDataStorage.registerAgent(agentData);
    await this.startAgent(agentData, true);
  }

  public async doesAgentExist(agentId: string): Promise<boolean> {
    if (!this.initialized) {
      const msg = 'do not call before initialization'; // TODO that message is kinda vague, rethink it
      this.logger.error(msg);
      throw new Error(msg);
    }

    // TODO what if agent is not initialized yet await this.agentsDataStorage.findAgent(agentId);

    const agent = !!this.agents[agentId];
    return !!agent;
  }

  public getAgentById(agentId: string): Agent {
    return this.agents[agentId];
  }
}

export class AgentsDataStorage {
  private storageInstance;

  constructor(storageInstance) {
    this.storageInstance = storageInstance;
  }

  public async getAgentsData(): Promise<AgentData[]> {
    const data = await this.storageInstance.findAll('agents');
    return data;
  }

  public async registerAgent(agentData: AgentData): Promise<void> {
    await this.storageInstance.save('agents', agentData);
  }
}

export class Agent {
  private config: AgentConfig;

  private logger: any;

  private ConnectionProvider: ConnectionProvider;

  private connection: Connection;

  private needSync = false;

  private data: AgentData;

  private plugins: Plugins = {};

  public id: string;

  public initialized: boolean;

  public initializing: Promise<any>;

  constructor(agentData: AgentData, connectionProvider: ConnectionProvider, config: AgentConfig, needSync: boolean) {
    this.id = agentData.id;
    this.data = agentData;
    this.ConnectionProvider = connectionProvider;
    this.config = config;
    this.needSync = needSync;
    this.logger = this.config.loggerProvider.getLogger('drill', `agent:${agentData.id}`);
    this.initializing = this.init();
  }

  private async init() {
    this.logger.info('init');
    await this.initConnection();
    this.initialized = true;
  }

  private async initConnection() {
    try {
      // TODO add connection status check
      // TODO what if we already have an open connection, should we re-use it or gracefully shutdown?
      if (this.connection) {
        const msg = 'connection is already established';
        this.logger.error(msg);
        throw new Error(msg); // TODO extend error to specify agent.id
      }

      const url = `${this.config.connection.protocol}://${this.config.connection.host}/agent/attach`;
      const options = {
        headers: {
          AgentConfig: JSON.stringify(this.data),
          needSync: this.needSync, // TODO find out what needSync really does
        },
      };

      this.connection = new this.ConnectionProvider(url, options);

      if (process.env.DEBUG_AGENT_SERVICE_CONNECTION === 'true') {
        this.connection._on = this.connection.on;
        this.connection.on = (event, handler) => {
          const wrappedHandler = (...args) => {
            this.logger.debug(`event: ${event}\n    arguments:\n    ${args}`);
            handler.apply(this, args);
          };
          this.connection._on(event, wrappedHandler);
        };
      }

      const connectionEstablished = new Promise((resolve, reject) => {
        this.connection.on('open', () => {
          this.logger.info('connection established');
          resolve();
        });
        const connectionTimeout = parseInt(process.env.AGENT_ESTABLISH_CONNECTON_TIMEOUT_MS, 10) || 10000;
        setTimeout(() => reject(), connectionTimeout);
      });

      this.connection.on('error', (...args) => {
        this.logger.error('connection error', ...args);
      });

      this.connection.on('close', (reasonCode, description) => {
        this.logger.info(`connection closed\n    reason ${reasonCode}\n    description${description}`);
      });

      this.connection.on('message', (message) => this.handleMessage(String(message)));

      await connectionEstablished;
    } catch (e) {
      const msg = `failed to establish connection!\n    error: ${e.message}\n    stack: ${e.stack}`;
      this.logger.error(msg);
      throw new Error(msg);
    }
  }

  private handleMessage(rawMessage: string) {
    const data = this.config.messageParseFunction(rawMessage);
    if (!data) return;

    const { destination } = data;
    this.sendDeliveryConfirmation(destination);

    if (destination === '/agent/load') {
      // HACK for non-Java agent implementation / sends signal to Java backend to load test2code plugin
      this.sendDeliveryConfirmation('/agent/plugin/test2code/loaded');
      return;
    }
    if (destination === '/plugin/togglePlugin') {
      const { message: { pluginId } } = data;
      this.togglePlugin(pluginId);
      return;
    }
    if (destination === '/plugin/action') {
      const { message: { id, message: action } } = data;
      const plugin = this.ensurePluginInstance(id);
      plugin.handleAction(action);
      return;
    }
    this.logger.debug(`received message for unknown destination.\n    destination: ${destination}\n    message: ${JSON.stringify(data)}`);
  }

  private send(data: DataPackage | ConfirmationPackage): void {
    const stringData = JSON.stringify(data);
    this.logger.silly('send', stringData);
    this.connection.send(stringData);
  }

  private sendDeliveryConfirmation(destination: string): void {
    const delivered = {
      type: 'MESSAGE_DELIVERED',
      destination,
    };
    this.send(delivered);
  }

  public ensurePluginInstance(pluginId: string): Plugin {
    if (this.plugins[pluginId]) {
      return this.plugins[pluginId];
    }
    return this.instantiatePlugin(pluginId);
  }

  private instantiatePlugin(pluginId: string): Plugin {
    this.logger.silly('instantiate plugin', pluginId);
    const PluginClass = this.config.availablePlugins[pluginId];
    const plugin = new PluginClass(
      pluginId,
      this.id,
      this.connection,
      {
        loggerProvider: this.config.loggerProvider,
      },
    );
    this.plugins[pluginId] = plugin;
    return plugin;
  }

  public async togglePlugin(pluginId: string): Promise<void> {
    this.logger.debug('toggle plugin', pluginId);
    const plugin = this.ensurePluginInstance(pluginId);
    // Note that currently plugin.init() is called only once, only during registration process.
    // Startup after middleware reboot does not require repeated plugin.init() call
    // because plugin is already "initiated" at drill backend.
    await plugin.init();
  }
}

interface IPlugin {
  new(pluginId: string, agentId: string, connection: Connection, config: PluginConfig): Plugin
}

interface PluginConfig {
  loggerProvider: ILoggerProvider
}

export class Plugin {
  protected id: string;

  protected agentId: string;

  protected config: PluginConfig;

  protected logger: any;
  // protected initialized: boolean;

  // protected initializing: Promise<unknown>;

  private connection: Connection;

  constructor(id: string, agentId: string, connection: Connection, config: PluginConfig) {
    this.id = id;
    this.agentId = agentId;
    this.connection = connection;
    this.config = config;
    this.logger = this.config.loggerProvider.getLogger('drill', `agent:${agentId}:${this.id}`);
  }

  public async init() { throw new Error(`${this.id} init not implemented`); }

  public hasMatchingId(someId: string) {
    return this.id === someId;
  }

  public handleAction(data) {
    throw new Error(`${this.id} handle action not implemented`);
  }

  public isTest2CodePlugin(): this is Test2CodePlugin {
    return this.hasMatchingId('test2code');
  }

  protected send(message) {
    this.logger.silly('send %O', message);
    const data = {
      type: 'PLUGIN_DATA',
      text: JSON.stringify({
        pluginId: this.id,
        drillMessage: { content: JSON.stringify(message) },
      }),
    };
    const stringData = JSON.stringify(data);
    this.connection.send(stringData);
  }
}

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
      astEntities: astService.formatForBackend(ast),
    };
    super.send(initDataPartMessage);

    // "launches" test2code plugin with AST & params prepared beforehand
    const initializedMessage: Initialized = { type: 'INITIALIZED', msg: '' };
    super.send(initializedMessage);

    // TODO memorize "agentId - initiated plugin" to define if
    this.logger.debug('init: done');
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

  public async updateAst(rawAst: unknown[]): Promise<void> {
    this.logger.debug('update ast');

    const ast = await astService.formatAst(rawAst); // TODO abstract AST processor
    await storage.saveAst(this.agentId, ast); // TODO abstract storage

    // TODO send INIT_DATA_PART if ast were updated during runtime? (and not at initialization)
  }

  public async updateSourceMaps(sourceMap): Promise<void> {
    this.logger.debug('update source maps');
    // await coverage
    await coverageService.saveSourceMap(this.agentId, sourceMap);
  }

  public async startSession(sessionId): Promise<void> {
    this.logger.debug('start session', sessionId);
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
    this.logger.debug('process coverage and finish session', sessionId);
    await this.ensureActiveSession(sessionId);

    const astTree = await storage.getAst(this.agentId);
    const { data: ast } = astTree;

    const data = await coverageService.processTestResults(this.agentId, ast, rawData);
    await this.sendTestResults(sessionId, data);

    await storage.removeSession(this.agentId, sessionId);
    const sessionFinishedMessage: SessionFinished = {
      type: 'SESSION_FINISHED',
      sessionId,
      ts: 0,
    };

    super.send(sessionFinishedMessage);
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

type MessageParseFunction = (rawMessage, ...args: unknown[]) => Message | void;

interface Message {
  destination: string,
  type: string,
  message: any, // TODO type it
}

// TODO would be much better to stringify JSON only ONCE, instead of multiple netsted levels. Suggest backend API enhancement
function parseJsonRecursive(rawMessage, l = 0) {
  if (l > 3) { // magic number due to unknown number of nested messages
    throw new Error(`Max recursive parse depth reached.\n   Not-parsed content: ${rawMessage}`);
  }
  const result = JSON.parse(rawMessage);
  // check both fields due to naming inconsistency on different message levels
  const content = result.text || result.message;
  const isContentJSON = content && (content[0] === '{' || content[0] === '[');
  if (isContentJSON) {
    // note that parsed data either from .text or .message gets assigned to "message" field
    result.message = parseJsonRecursive(content, l + 1);
    delete result.text;
  }
  return result;
}

interface AgentsMap {
  [agentId: string]: Agent
}

export interface AgentData {
  id: string,
  agentType: 'NODEJS',
  instanceId: string, // TODO what is that for and how it should be configured
  buildVersion: string, // TODO what is that for and how it should be configured
  serviceGroupId: string, // TODO what is that for and how it should be configured
}

export interface AgentHubConfig {
  loggerProvider: ILoggerProvider,
  agent: {
    connection: AgentConnectionConfig
  }
}

interface AgentConfig {
  connection: AgentConnectionConfig,
  messageParseFunction: MessageParseFunction,
  availablePlugins: {
    [pluginId: string]: IPlugin
  },
  loggerProvider: ILoggerProvider,
}

interface AgentConnectionConfig {
  protocol: string,
  host: string,
}

interface Scope {
  id: string,
  name: string,
  prevId: string,
  ts: number,
}

interface Connection {
  on(event: string, handler: Handler): unknown;
  _on?(event: string, handler: Handler): unknown;
  send(data: string): unknown; // TODO set data type to Package
}

interface ConnectionProvider {
  new(url: string, options: any): Connection; // TODO decsribe options
}

interface Plugins {
  [pluginId: string]: Plugin
}

interface AvailablePlugins {
  [pluginId: string]: IPlugin
}

type Handler = (...args: unknown[]) => unknown;

interface Package {
  type: string, // TODO describe type enum
}

interface ConfirmationPackage extends Package {
  destination: string,
}

interface DataPackage extends Package {
  text: string,
}
