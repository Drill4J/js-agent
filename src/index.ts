import { App } from './app';
import storage from './storage';
import { agentSocket } from './services/agent.service';
import { getAst } from './services/ast.service';

async function start(): Promise<void> {
  console.log('Starting...');
  await storage.init();
  const app = new App();
  await app.start();
  const astTree = await getAst();
  if (astTree && astTree.data) {
    await agentSocket.init(astTree.data, false);
  }
}

export default start();
