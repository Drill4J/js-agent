/*
 * Copyright 2020 EPAM Systems
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import Koa, { ExtendableContext, Middleware, Next } from 'koa';
import Router, { IRouterParamContext } from 'koa-router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';

import responseHandler from './middleware/response.handler';

import loggerMiddleware from './middleware/logger';
import populateCtxWithPlugin from './middleware/populate.req.with.plugin';
import populateCtxWithAgent from './middleware/populate.req.with.agent';

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
      populateCtxWithAgent: populateCtxWithAgent.bind(this),
      responseHandler: responseHandler.bind(this),
    };

    this.agentHub = agentHub;
    this.config = config;
    this.logger = this.config.loggerProvider.getLogger('webserver');
    this.app = new Koa();

    this.app.use(
      bodyParser({
        jsonLimit: this.config.body?.json?.limit || '500mb',
        formLimit: this.config.body?.urlencoded?.limit || '500mb',
      }),
    );
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

    router.post(
      '/agents/:agentId/plugins/:pluginId/build',
      async (ctx: ExtendableContext & IRouterParamContext, next: Next) => {
        const agentId = String(ctx.params.agentId);

        const agentExists = await this.agentHub.doesAgentExist(agentId);
        const { version, groupId } = ctx.request.body;
        const agentData: AgentData = {
          id: agentId,
          // send build version in place of instanceId to avoid mixing up classes from different versions
          instanceId: version, // TODO implement actual instanceId (Idk how yet)
          //   or just make _build verfsion_ the ID of the "unique classes set" (risky due to runtime code changes / differences)
          buildVersion: version,
          serviceGroupId: groupId || '',
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
        const { data, version } = ctx.request.body;
        await test2Code.updateBuildInfo(version, data);
      },
    );

    router.get(
      '/agents/:agentId/build/:buildVersion/plugins/:pluginId/ast',
      this.middlewares.populateCtxWithAgent,
      populateCtxWithPlugin,
      async (ctx: ExtendableContext & IRouterParamContext, next: Next) => {
        ctx.response.body = await ctx.state.drill.test2Code.getAst(ctx.params.buildVersion);
      },
    );

    this.app.use(router.routes());
  }
}
