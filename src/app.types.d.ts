import { ILoggerProvider } from './util/logger';
import {
  Agent,
  Test2CodePlugin,
} from './services/agent.hub';

export interface AppConfig {
  port: number,
  body?: {
    json?: { limit: string, }
    urlencoded?: { limit: string, }
  },
  loggerProvider: ILoggerProvider
}

declare module 'koa' {
  interface ExtendableContext {
    state: {
      drill: {
        agent: Agent,
        test2Code?: Test2CodePlugin
      }
    }
  }
}
