import Koa, { ExtendableContext, Middleware, Next } from 'koa';
import Router, { IRouterParamContext } from 'koa-router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';

import responseHandler from './middleware/response.handler';

import loggerMiddleware from './middleware/logger';
import populateCtxWithAgent from './middleware/populate.req.with.agent';
import populateCtxWithPlugin from './middleware/populate.req.with.plugin';

import { ILogger } from './util/logger';
import { AppConfig } from './app.types';

import { AgentHub } from './services/hub';
import { AgentData } from './services/agent/types';

export class App {
  public app: Koa;

  private config: AppConfig;

  private agentHub: AgentHub;

  private middlewares: { [key: string]: Middleware };

  private logger: ILogger;

  constructor(config: AppConfig, agentHub: AgentHub) {
    this.middlewares = {
      responseHandler: responseHandler.bind(this),
      populateCtxWithAgent: populateCtxWithAgent.bind(this),
    };

    this.agentHub = agentHub;
    this.config = config;
    this.logger = this.config.loggerProvider.getLogger('drill', 'webserver');
    this.app = new Koa();

    this.app.use(bodyParser({
      jsonLimit: this.config.body?.json?.limit || '50mb',
      formLimit: this.config.body?.urlencoded?.limit || '50mb',
    }));
    this.app.use(cors());
    this.app.use(loggerMiddleware(this.logger));
    this.setRoutes();
  }

  public async start(): Promise<Koa> {
    return new Promise((resolve, reject) => {
      this.app.listen(this.config.port, () => {
        this.logger.info(`running at http://localhost:${this.config.port} in ${process.env.NODE_ENV || 'development'} mode
        \n press CTRL-C to stop`);
        resolve(this.app);
      });
      const timeout = parseInt(process.env.WEBSERVER_LAUNCH_TIMEOUT, 10) || 10000;
      setTimeout(() => reject(new Error(`timeout of ${timeout}ms exceeded`)), timeout);
    });
  }

  private setRoutes() {
    const router = new Router();

    router.use(this.middlewares.responseHandler);
    router.get('/', () => ({ message: 'JS middleware API' }));

    router.post('/agents/:agentId/plugins/:pluginId/build',
      async (ctx: ExtendableContext & IRouterParamContext, next: Next) => {
        const agentId = String(ctx.params.agentId);

        const agentExists = await this.agentHub.doesAgentExist(agentId);
        const { version } = ctx.request.body;
        const agentData: AgentData = {
          id: agentId,
          instanceId: '',
          buildVersion: version,
          serviceGroupId: '',
          agentType: 'NODEJS',
        };
        if (agentExists) {
          const agent = this.agentHub.getAgentById(agentData.id);
          await agent.updateBuildVersion(agentData);
          agent.checkPluginInstanceExistence('test2code');
          ctx.state.drill = {
            agent,
          };
        } else {
          const newAgent = await this.agentHub.registerAgent(agentData);
          ctx.state.drill = {
            agent: newAgent,
          };
        }
        return next();
      },
      populateCtxWithPlugin,
      async (ctx: ExtendableContext) => {
        const { test2Code } = ctx.state.drill;
        const { data } = ctx.request.body;
        await test2Code.updateBuildInfo(data);
      });

    const test2CodeRouter = new Router();
    test2CodeRouter.post('/sessions/:sessionId', (ctx: ExtendableContext & IRouterParamContext) =>
      ctx.state.drill.test2Code.startSession(ctx.params.sessionId));

    test2CodeRouter.patch('/sessions/:sessionId', (ctx: ExtendableContext & IRouterParamContext) =>
      ctx.state.drill.test2Code.finishSession(ctx.params.sessionId, ctx.request.body));

    test2CodeRouter.delete('/sessions/:sessionId', (ctx: ExtendableContext & IRouterParamContext) =>
      ctx.state.drill.test2Code.cancelSession(ctx.params.sessionId));

    // TODO dynamic plugin route initialization
    router.use('/agents/:agentId/plugins/:pluginId',
      this.middlewares.populateCtxWithAgent,
      populateCtxWithPlugin,
      test2CodeRouter.routes());

    this.app.use(router.routes());
  }
}
