import { ILoggerProvider } from '../../util/logger';
import { AgentConfig } from '../agent/types';

export interface AgentHubConfig {
  loggerProvider: ILoggerProvider;
  agentConfig: AgentConfig;
}

// TODO there is a mismatch between expected AgentData format accepted on backend and supplied from backend
export interface AgentsInfoProvider {
  get(): Promise<any[]>;
}
