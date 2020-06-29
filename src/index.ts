import { App } from './app';
import storage from './storage';
import { agentService } from './services/agent.service';
import { getAst } from './services/ast.service';

async function start(): Promise<void> {
  console.log('Starting...');
  await storage.init();
  const app = new App({ port: Number(process.env.APP_PORT) || 8080 });
  await app.start();
  const astTree = await getAst();
  if (astTree && astTree.data) {
    await agentService.init(astTree.data, false);
  }
}

export default start();
