import { ILoggerProvider } from './util/logger';
import { Agent } from './services/agent';
import { Test2CodePlugin } from './services/plugin/test2code';

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
        test2Code?: Test2CodePlugin,
        test2CodeCtx?: {
          isLiveUpdate: boolean
        }
      }
    }
  }
}
