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

    ok: (response?: unknown) => Context;
    created: (response?: unknown) => Context;
    noContent: (response?: unknown) => Context;
    badRequest: (response?: unknown) => Context;
    unauthorized: (response?: unknown) => Context;
    forbidden: (response?: unknown) => Context;
    notFound: (response?: unknown) => Context;
    locked: (response?: unknown) => Context;
    internalServerError: (response?: unknown) => Context;
    notImplemented: (response?: unknown) => Context;
  }
}
