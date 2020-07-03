/* eslint-disable max-classes-per-file */
/* eslint-disable import/no-unresolved */ // TODO configure local-module-first resolution (for development purposes)
import {
  // Models
  AstEntity,
  InitScopePayload,
  // Actions
  InitActiveScope,
  // Messages
  InitInfo,
  InitDataPart,
  Initialized,
  ScopeInitialized,
} from '@drill4j/test2code-types';

export class AgentHub {
  private config: AgentHubConfig;

  private agentsDataStorage: AgentsDataStorage;

  private AgentConnectionProvider: ConnectionProvider;

  private logger: Logger = console;

  private agents: AgentsMap = {};

  public ready: Promise<any>;

  constructor(agentsDataStorage: AgentsDataStorage, agentConnectionProvider: ConnectionProvider, config: AgentHubConfig) {
    this.agentsDataStorage = agentsDataStorage;
    this.AgentConnectionProvider = agentConnectionProvider;
    this.config = config;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.initAgents();
  }

  private async initAgents(): Promise<void> {
    const agentsData = await this.agentsDataStorage.getAgentsData();
    agentsData.map((agentData: AgentData) => this.startAgent(agentData));
  }

  public async startAgent(agentData: AgentData, isNew = false): Promise<void> {
    const agentConfig: AgentConfig = {
      connection: this.config.agent.connection,
    };
    const agent = new Agent(agentData, this.AgentConnectionProvider, agentConfig, isNew);
    await agent.ready;
    this.agents[agent.id] = agent;
  }

  public async registerAgent(agentData: AgentData): Promise<void> {
    await this.agentsDataStorage.registerAgent(agentData);
    await this.startAgent(agentData, true);
  }

  public async doesAgentExist(agentId: string): Promise<boolean> {
    // TODO what if HUB is not initialized yet? (perhaps nothing, you should wait for ready status first)

    // TODO what if specific agent is not initialized just yet?
    // that could become a problem (e.g. agent instance swap in map with losing data)

    // await this.agentsDataStorage.findAgent(agentId);
    return !!this.agents[agentId];
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

  // TODO either make a wrapper with this.id or build loggers from debug with id on-the-fly
  private logger: Logger = console;

  private ConnectionProvider: ConnectionProvider;

  private connection: Connection;

  private needSync = false;

  private data: AgentData;

  public id: string;

  public ready: Promise<any>;

  constructor(agentData: AgentData, connectionProvider: ConnectionProvider, config: AgentConfig, needSync: boolean) {
    this.id = agentData.id;
    this.data = agentData;
    this.ConnectionProvider = connectionProvider;
    this.config = config;
    this.needSync = needSync;
    this.ready = this.init();
  }

  private async init() {
    this.logger.log(`${this.id} init`);
    this.initConnection();
  }

  private initConnection() {
    if (this.connection) { // TODO add connection status check
      throw new Error('Connection is established already!'); // TODO extend error to specify agent.id
    }
    const url = `${this.config.connection.protocol}://${this.config.connection.host}/agent/attach`;
    const options = {
      headers: {
        AgentConfig: JSON.stringify(this.data),
        needSync: this.needSync, // TODO find out what needSync really does
      },
    };
    // TODO what if we already have an open connection, should we re-use it or gracefully shutdown?
    this.connection = new this.ConnectionProvider(url, options);

    if (process.env.DEBUG_AGENT_SERVICE_CONNECTION === 'true') {
      this.connection._on = this.connection.on;
      this.connection.on = (event, handler) => {
        const wrappedHandler = (...args) => {
          console.log(`agent ${this.id}: got message:`, event, args);
          handler.apply(this, args);
        };
        this.connection._on(event, wrappedHandler);
      };
    }
    this.setupHandlers();
  }

  private setupHandlers() {
    this.connection.on('message', (message) => this.handleMessage(String(message)));

    this.connection.on('open', () => {
      console.log('AgentService established connection!');
    });

    this.connection.on('close', () => {
      console.error('AgentService lost connection!');
    });
  }

  private handleMessage(rawMessage: string) {
    try {
      const data = JSON.parse(rawMessage);
      console.log(data);
    } catch (e) {
      console.log(e);
    }
  }

  // TODO move test2code actions to plugin code (requires pluginId to be specified in extension request)
  public async updateAst(astEntities: AstEntity[]): Promise<void> {
    this.logger.log(`${this.id} updateAst`);
  }

  public async updateSourceMaps(sourceMap): Promise<void> {
    this.logger.log(`${this.id} updateSourceMaps`);
  }
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
  connection: AgentConnectionConfig
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

interface Connection {
  on(event: string, handler: Handler): unknown;
  _on?(event: string, handler: Handler): unknown;
  send(data: string): unknown; // TODO set data type to Package
}

interface ConnectionProvider {
  new(url: string, options: any): Connection; // TODO decsribe options
}

type Handler = (...args: unknown[]) => unknown;

// interface AgentHubConfig {
//   LoggerProvider: (prefix: string) => {
//     const test = function test(params:string) {}; return test;
//   }
// }

// interface LoggerProvider {
//   (loggerName: string) => ()
// }
