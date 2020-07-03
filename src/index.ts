import Websocket from 'ws';
import { App } from './app';
import storage from './storage';
import { agentService } from './services/agent.service';
import { getAst } from './services/ast.service';
import { AgentHub, AgentsDataStorage, AgentHubConfig } from './services/agent.hub';

async function start(): Promise<void> {
  console.log('Starting...');

  await storage.init();

  const agentsDataStorage = new AgentsDataStorage(storage);
  const agentHubConfig: AgentHubConfig = {
    agent: {
      connection: {
        protocol: process.env.DRILL_ADMIN_PROTOCOL || 'ws',
        host: process.env.DRILL_ADMIN_HOST,
      },
    },
  };
  const agentHub = new AgentHub(agentsDataStorage, Websocket, agentHubConfig);
  await agentHub.ready;

  const app = new App(
    { port: Number(process.env.APP_PORT) || 8080 },
    agentHub,
  );
  await app.start();
  // const astTree = await getAst();
  // if (astTree && astTree.data) {
  //   await agentService.init(astTree.data, false);
  // }
}

export default start();
