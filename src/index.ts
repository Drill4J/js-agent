import Websocket from 'ws';
import { App } from './app';
import storage from './storage';
import { AgentHubConfig } from './services/hub/types';
import { AgentHub } from './services/hub';
import LoggerProvider from './util/logger'; // TODO path aliases
import * as AgentsDataProvider from './agents.data.provider';

const startupLogger = LoggerProvider.getLogger('drill', 'startup');

async function start(): Promise<void> {
  startupLogger.info('starting');

  await storage.init();

  const agentHubConfig: AgentHubConfig = {
    loggerProvider: LoggerProvider,
    connection: {
      protocol: process.env.DRILL_ADMIN_PROTOCOL || 'ws',
      host: process.env.DRILL_ADMIN_HOST,
    },
  };
  const agentHub = new AgentHub(AgentsDataProvider, Websocket, agentHubConfig);
  await agentHub.initializing;

  const app = new App(
    {
      port: Number(process.env.APP_PORT) || 8080,
      loggerProvider: LoggerProvider,
    },
    agentHub,
  );
  await app.start();
}

export default start();
