import { ILoggerProvider } from '../../util/logger';
import { AgentInfo } from '../agent/types';

export interface AgentHubConfig {
  loggerProvider: ILoggerProvider,
  connection: {
    protocol: string,
    host: string
  }
}

// TODO there is a mismatch between expected AgentData format accepted on backend and supplied from backend
export interface AgentsInfoProvider {
  get(): Promise<any[]>
}
