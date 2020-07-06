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

import * as astService from './ast.service';
import * as coverageService from './coverage.service';
import storage from '../storage';

export class AgentHub {
  private config: AgentHubConfig;

  private agentsDataStorage: AgentsDataStorage;

  private AgentConnectionProvider: ConnectionProvider;

  private logger: Logger = console;

  private agents: AgentsMap = {};

  public initialized: boolean;

  public initializing: Promise<any>;

  constructor(agentsDataStorage: AgentsDataStorage, agentConnectionProvider: ConnectionProvider, config: AgentHubConfig) {
    this.agentsDataStorage = agentsDataStorage;
    this.AgentConnectionProvider = agentConnectionProvider;
    this.config = config;
    this.initializing = this.init();
  }

  private async init(): Promise<void> {
    await this.initAgents();
    this.initialized = true;
  }

  private async initAgents(): Promise<void> {
    const agentsData = await this.agentsDataStorage.getAgentsData();
    const agentsInitializing = agentsData.map((agentData: AgentData) => this.startAgent(agentData));
    await Promise.all(agentsInitializing);
  }

  public async startAgent(agentData: AgentData, isNew = false): Promise<void> {
    // TODO what if agent already started?
    const agentConfig: AgentConfig = {
      connection: this.config.agent.connection,
      messageParseFunction: parseJsonRecursive,
      availablePlugins: { // TODO dynamic plugins import
        test2code: Test2CodePlugin,
      },
    };

    const agent = new Agent(agentData, this.AgentConnectionProvider, agentConfig, true); // TODO figure out needSync
    this.agents[agent.id] = agent;
    await agent.initializing;
  }

  public async registerAgent(agentData: AgentData): Promise<void> {
    console.log('AgentHub registerAgent', agentData);
    // TODO what if agent already registered?
    await this.agentsDataStorage.registerAgent(agentData);
    await this.startAgent(agentData, true);
  }

  public async doesAgentExist(agentId: string): Promise<boolean> {
    if (!this.initialized) throw new Error('AgentHub is not initialized yet!');

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
    console.log('AgentsDataStorage registerAgent', agentData);
    await this.storageInstance.save('agents', agentData);
  }
}

export class Agent {
  private config: AgentConfig;

  // TODO either make a wrapper with this.id or build loggers from debug with id on-the-fly
  private logger: Logger = console;

  private ConnectionProvider: ConnectionProvider;

  private connection: Connection;

  private needSync = false;

  private data: AgentData;

  private plugins: Plugins = {};

  private messageParseFunction: MessageParseFunction;

  public id: string;

  public initialized: boolean;

  public initializing: Promise<any>;

  constructor(agentData: AgentData, connectionProvider: ConnectionProvider, config: AgentConfig, needSync: boolean) {
    this.id = agentData.id;
    this.data = agentData;
    this.ConnectionProvider = connectionProvider;
    this.config = config;
    this.needSync = needSync;
    this.initializing = this.init();
  }

  private async init() {
    this.logger.log(`agent ${this.id} init`);
    await this.initConnection();
    this.initialized = true;
  }

  private async initConnection() {
    try {
      // TODO add connection status check
      // TODO what if we already have an open connection, should we re-use it or gracefully shutdown?
      if (this.connection) {
        throw new Error('Connection is established already!'); // TODO extend error to specify agent.id
      }

      const url = `${this.config.connection.protocol}://${this.config.connection.host}/agent/attach`;
      const options = {
        headers: {
          AgentConfig: JSON.stringify(this.data),
          needSync: this.needSync, // TODO find out what needSync really does
        },
      };

      this.connection = new this.ConnectionProvider(url, options);

      const connectionEstablished = new Promise((resolve, reject) => {
        this.connection.on('open', () => {
          console.log(`agent ${this.id} established connection!`);
          resolve();
        });
        const connectionTimeout = parseInt(process.env.AGENT_ESTABLISH_CONNECTON_TIMEOUT_MS, 10) || 10000;
        setTimeout(() => reject(), connectionTimeout);
      });

      this.connection.on('error', (...args) => {
        console.log('error', args);
      });

      this.connection.on('close', (reasonCode, description) => {
        console.log(`agent ${this.id} connections closed.\n   Reason ${reasonCode}\n    Description ${description}!`);
      });

      this.connection.on('message', (message) => this.handleMessage(String(message)));

      if (process.env.DEBUG_AGENT_SERVICE_CONNECTION === 'true') {
        this.connection._on = this.connection.on;
        this.connection.on = (event, handler) => {
          const wrappedHandler = (...args) => {
            console.log(`agent ${this.id}.on('`, event, ')\n   Arguments:', args);
            handler.apply(this, args);
          };
          this.connection._on(event, wrappedHandler);
        };
      }
      await connectionEstablished;
    } catch (e) {
      throw new Error(`agent ${this.id} failed to establish connection!\n   Error: ${e.message}\n   Stack: ${e.stack}`);
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
      const plugin = this.plugins[id];
      plugin.handleAction(action);
      return;
    }
    console.log(`received message for unknown destination.\n  Destination: ${destination}\n  Message: ${JSON.stringify(data)}`);
  }

  private send(data: DataPackage | ConfirmationPackage): void {
    const stringData = JSON.stringify(data);
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

    const plugin = new this.config.availablePlugins[pluginId](pluginId, this.id, this.connection);
    this.plugins[pluginId] = plugin;
    return plugin;
  }

  public async togglePlugin(pluginId: string): Promise<void> {
    await this.plugins[pluginId].init();
  }
}

interface PluginClass {
  new(pluginId: string, agentId: string, connection: Connection): Plugin
}

export class Plugin {
  protected id: string;

  protected agentId: string;

  // protected initialized: boolean;

  // protected initializing: Promise<unknown>;

  private connection: Connection;

  constructor(id, agentId, connection) {
    this.id = id;
    this.agentId = agentId;
    this.connection = connection;
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

class Test2CodePlugin extends Plugin {
  private ast: AstEntity[];

  private activeScope: Scope;

  public async init() {
    console.log('Test2Code init...');
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

    // sends AST (if needed)
    // if (this.needSync) {
    // non-Java agent AST initialization
    // it is workaround due to legacy reasons
    // it differs from Java agent's implementation (you won't find INIT_DATA_PART in java agent sourcecode)
    const initDataPartMessage: InitDataPart = {
      type: 'INIT_DATA_PART',
      astEntities: astService.formatForBackend(this.ast), // TODO not safe
    };
    super.send(initDataPartMessage);
    // }

    // "launches" test2code plugin with AST & params prepared beforehand
    const initializedMessage: Initialized = { type: 'INITIALIZED', msg: '' };
    super.send(initializedMessage);

    console.log('Test2Code initiated!');
  }

  public handleAction(action) {
    if (this.isInitActiveScopeAction(action)) {
      console.log('init active scope', action.payload);
      this.setActiveScope(action.payload);
      return;
    }
    console.log(`test2code: received unknown action.\n  Action: ${JSON.stringify(action)}`);
  }

  private setActiveScope(payload: InitScopePayload) {
    const { id, name, prevId } = payload;
    this.activeScope = {
      id,
      name,
      prevId,
      ts: Date.now(),
    };
    // storage.deleteSessions({activeScope: { id }}]});
    console.error('!!!TODO setActiveScope - implement delete sessions');

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
    console.log(`plugin ${this.id} updateAst`, rawAst);

    const ast = await astService.formatAst(rawAst); // TODO abstract AST processor
    await storage.saveAst(this.agentId, ast); // TODO abstract storage
    this.ast = ast;
  }

  public async updateSourceMaps(sourceMap): Promise<void> {
    // await coverage
    await coverageService.saveSourceMap(this.agentId, sourceMap);
    console.log(`agent ${this.id} plugin ${this.id} updateSourceMaps`);
  }

  public async startSession(sessionId): Promise<void> {
    await storage.saveSession(this.agentId, sessionId);

    const sessionStartedMessage: SessionStarted = {
      type: 'SESSION_STARTED',
      sessionId,
      testType: 'MANUAL', // TODO send actuall test type, dont just send 'MANUAL'
      ts: 0,
    };

    super.send(sessionStartedMessage);
  }

  public async finishSession(sessionId): Promise<void> {
    await storage.removeSession(this.agentId, sessionId);

    const sessionFinishedMessage: SessionFinished = {
      type: 'SESSION_FINISHED',
      sessionId,
      ts: 0,
    };

    super.send(sessionFinishedMessage);
  }

  public async processCoverage(rawData): Promise<any> {
    // TODO check if session exists and still active
    const session = await storage.getSession(this.agentId); // TODO support multiple sessions
    const { id: sessionId } = session;
    const astTree = await storage.getAst(this.agentId);
    const { data: ast } = astTree;
    const data = await coverageService.processTestResults(this.agentId, ast, rawData);
    await this.sendTestResults(sessionId, data);
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

function parseJsonRecursive(rawMessage, l = 0) {
  if (l > 3) {
    throw new Error(`Max recursive parse depth reached.\n   Not-parsed content: ${rawMessage}`);
  }
  try {
    const result = JSON.parse(rawMessage);
    const content = result.text || result.message;
    const isContentJSON = content && (content[0] === '{' || content[0] === '[');
    if (isContentJSON) {
      result.message = parseJsonRecursive(content, l + 1);
      delete result.text;
    }
    return result;
  } catch (e) {
    console.log(`received malformed JSON.\n  Error: ${e}\n  Original message: ${rawMessage}`);
  }
  throw new Error('Failed to parse');
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
  agent: {
    connection: AgentConnectionConfig
  }
}

interface AgentConfig {
  connection: AgentConnectionConfig,
  messageParseFunction: MessageParseFunction,
  availablePlugins: {
    [pluginId: string]: PluginClass
  }
}

interface AgentConnectionConfig {
  protocol: string,
  host: string,
}

interface Logger {
  log(...args: any[]): void,
  warn?(...args: any[]): void,
  error?(...args: any[]): void,
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
// interface AgentHubConfig {
//   LoggerProvider: (prefix: string) => {
//     const test = function test(params:string) {}; return test;
//   }
// }

// interface LoggerProvider {
//   (loggerName: string) => ()
// }
