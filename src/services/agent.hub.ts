/* eslint-disable max-classes-per-file */
import {
  AgentData,
  AgentConfig,
  Message,
} from './agent.types';
import { AgentHubConfig, ConnectionProvider } from './agent.hub.types';
import { Agent, AgentsMap } from './agent';
import { Test2CodePlugin } from './plugins/test2code';
import parseJsonRecursive from '../util/parse-json-recursive';
import { AvailablePlugins } from './plugin';

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

  public async startAgent(agentData: AgentData, isNew = false): Promise<Agent> {
    this.logger.info('start agent:', agentData.id);
    // TODO what if agent already started?

    const availablePlugins: AvailablePlugins = {
      test2code: Test2CodePlugin, // TODO there must be a way to resolve that with type system instead of hardcoded key
    };

    const agentConfig: AgentConfig = {
      loggerProvider: this.config.loggerProvider,
      connection: this.config.connection,
      messageParseFunction: (rawMessage) => (parseJsonRecursive(rawMessage) as Message),
      availablePlugins,
    };

    const agent = new Agent(agentData, this.AgentConnectionProvider, agentConfig, isNew); // TODO figure out needSync
    this.agents[agent.id] = agent;
    await agent.initializing;
    return agent;
  }

  public async restartAgent(agentData: AgentData): Promise<Agent> {
    this.logger.info('restart agent %o', agentData);
    const agent = this.getAgentById(agentData.id);

    // note that agentData.buildVersion is a supposedly "new" buildVersion
    agent.checkUniqueBuildVersion(agentData.buildVersion);

    const pluginsIds = agent.getPluginsIds();
    await this.stopAndRemoveAgent(agent);

    const restartedAgent = await this.startAgent(agentData);
    await Promise.all(pluginsIds.map(pluginId => restartedAgent.ensurePluginInstance(pluginId)));
    return restartedAgent;
  }

  private async stopAndRemoveAgent(agent: Agent) {
    await agent.stop();
    delete this.agents[agent.data.id];
  }

  public async registerAgent(agentData: AgentData): Promise<Agent> {
    this.logger.info('register agent %o', agentData);
    // TODO what if agent already registered?
    await this.agentsDataStorage.registerAgent(agentData);
    return this.startAgent(agentData, true);
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
