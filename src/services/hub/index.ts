import {
  AgentHubConfig,
  ConnectionProvider,
  AgentsDataProvider,
} from './types';
import {
  AgentData,
  AgentConfig,
  Message,
} from '../agent/types';
import { Agent, AgentsMap } from '../agent';
import { AvailablePlugins } from '../plugin';
import { Test2CodePlugin } from '../plugin/test2code';
import parseJsonRecursive from '../../util/parse-json-recursive';

export class AgentHub {
  private config: AgentHubConfig;

  private agentsDataProvider: AgentsDataProvider;

  private AgentConnectionProvider: ConnectionProvider;

  private logger: any;

  private agents: AgentsMap = {};

  public initialized: boolean;

  public initializing: Promise<any>;

  // TODO choose suitable dependency injection plugin to avoid passing logger via config
  constructor(agentsDataProvider: AgentsDataProvider, agentConnectionProvider: ConnectionProvider, config: AgentHubConfig) {
    this.agentsDataProvider = agentsDataProvider;
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
    const agentsList = await this.agentsDataProvider.get(); // TODO no any!
    const agentsInitializing = agentsList.map((x) => this.startAgent(x));
    await Promise.all(agentsInitializing);
  }

  public async startAgent(agentInfo: any, isNew = false): Promise<Agent> {
    this.logger.info('start agent:', agentInfo.data.id);
    // TODO what if agent already started?

    const availablePlugins: AvailablePlugins = {
      test2code: Test2CodePlugin, // TODO there must be a way to resolve that with type system instead of hardcoded key
    };

    const agentConfig: AgentConfig = { // TODO agent config never changes, supply it in hub config!
      loggerProvider: this.config.loggerProvider,
      connection: this.config.connection,
      messageParseFunction: (rawMessage) => (parseJsonRecursive(rawMessage) as Message),
      availablePlugins,
    };

    // TODO supply this.AgentConnectionProvider in agentConfig!
    const agent = new Agent(agentInfo, this.AgentConnectionProvider, agentConfig, isNew); // TODO figure out needSync
    this.agents[agent.data.id] = agent;
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
    return this.startAgent({ data: agentData }, true);
  }

  public async doesAgentExist(agentId: string): Promise<boolean> {
    if (!this.initialized) {
      const msg = 'do not call before initialization'; // TODO that message is kinda vague, rethink it
      this.logger.error(msg);
      throw new Error(msg);
    }

    // TODO what if agent is not initialized yet? // await agentsDataProvider.isRegistered(agentId)

    const agent = !!this.agents[agentId];
    return !!agent;
  }

  public getAgentById(agentId: string): Agent {
    return this.agents[agentId];
  }
}
