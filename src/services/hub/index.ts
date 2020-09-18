import { AgentHubConfig, AgentsInfoProvider } from './types';
import { AgentData, AgentConfig, Message } from '../agent/types';
import { Agent, AgentsMap } from '../agent';

export class AgentHub {
  private config: AgentHubConfig;

  private agentsInfoProvider: AgentsInfoProvider;

  private logger: any;

  private agents: AgentsMap = {};

  public initialized: boolean;

  public initializing: Promise<any>;

  // TODO choose suitable dependency injection plugin to avoid passing logger via config
  constructor(agentsInfoProvider: AgentsInfoProvider, config: AgentHubConfig) {
    this.agentsInfoProvider = agentsInfoProvider;
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
    const agentsList = await this.agentsInfoProvider.get(); // TODO no any!
    const agentsInitializing = agentsList.map(x => this.startAgent(x));
    await Promise.all(agentsInitializing);
  }

  public async startAgent(agentInfo: any, isNew = false): Promise<Agent> {
    const agentId = agentInfo.data.id;
    this.logger.info('start agent:', agentId);
    // TODO what if agent already started?

    const agent = new Agent(agentInfo, this.config.agentConfig, isNew); // TODO figure out needSync
    this.agents[agentId] = agent;
    await agent.initializing;
    return agent;
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

    // TODO what if agent is not initialized yet? // await agentsInfoProvider.isRegistered(agentId)

    const agent = !!this.agents[agentId];
    return !!agent;
  }

  public getAgentById(agentId: string): Agent {
    return this.agents[agentId];
  }
}
