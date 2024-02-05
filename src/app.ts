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
import { Test2CodePlugin } from './services/plugin/test2code';
import { ILogger } from './util/logger';
import { AgentKey, AppConfig } from './app.types';
import AdminAPI from './admin-api';
import { AddSessionData, AgentConfig } from '@drill4j/test2code-types';
import { formatAst, formatForBackend } from 'services/plugin/test2code/processors/ast';

export class App {
  public app: Koa;

  private config: AppConfig;

  private middlewares: { [key: string]: Middleware };

  private logger: ILogger;

  private agentKeyToConverter: { [key: string]: Test2CodePlugin } = {};

  constructor(config: AppConfig) {
    this.middlewares = {
      responseHandler: responseHandler.bind(this),
    };

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

    router.get('/', () => ({ message: 'js-agent API' }));

    // Accept new build data sent by js-parser
    router.post('/agents/:agentId/plugins/test2code/build', async (ctx: ExtendableContext & IRouterParamContext) => {
      const agentId = String(ctx.params.agentId);
      const { version, groupId, data } = ctx.request.body;
      const { bundleFiles, config, data: rawAstEntites } = data;
      const agentKey = getAgentBuildKey(groupId, agentId, version);

      // STEP#1 Send instance metadata
      const agentConfig: AgentConfig = {
        id: agentId,
        // send build version in place of instanceId to avoid mixing up classes from different versions
        instanceId: version, // TODO implement actual instanceId (Idk how yet)
        //   or just make _build verfsion_ the ID of the "unique classes set" (risky due to runtime code changes / differences)
        buildVersion: version,
        serviceGroupId: groupId || '',
        agentType: 'NODEJS',
        agentVersion: '',
      };

      await AdminAPI.sendInstance(agentId, agentConfig);

      // HACK to allow admin save AgentConfig data before accepting classes
      // TODO remove once test2code is removed from admin
      await new Promise((res, _) => setTimeout(res, 1000));

      // STEP#2 Send classes metadata
      const astEntities = formatForBackend(formatAst(rawAstEntites));
      await AdminAPI.sendClassMetadata(agentId, version, astEntities);

      // TODO remove completed once migrated to new metrics calc
      // STEP#3 Send completed
      await AdminAPI.sendClassMetadataCompleted(agentId, version);

      // STEP#4 Create coverage mapper
      if (this.agentKeyToConverter[agentKey] != undefined) return;

      console.log('create converter...', agentKey);
      this.agentKeyToConverter[agentKey] = new Test2CodePlugin(agentKey, this.config.loggerProvider);
      console.log('converter created', agentKey);
      console.log('save build metadata...', agentKey);
      await this.agentKeyToConverter[agentKey].saveBuildMetadata(agentKey, data);
      console.log('build metadata saved', agentKey);
    });

    // Accept raw v8 coverage; map it to original source; send mapped coverage to Admin Backend
    router.post(
      '/groups/:groupId/agents/:agentId/builds/:buildVersion/v8-coverage',
      async (ctx: ExtendableContext & IRouterParamContext) => {
        const { groupId, agentId, buildVersion } = ctx.params;
        const { data, sessionId } = (ctx.request.body as AddSessionData).payload;
        const agentKey = getAgentBuildKey(groupId, agentId, buildVersion);

        console.log('convert coverage for', agentKey);

        const converter = this.agentKeyToConverter[agentKey];
        if (!converter) {
          console.log('no coverter for', agentKey);
        }

        const coverage = await converter.convertV8Coverage(agentKey, data, sessionId);

        await AdminAPI.sendCoverage(agentId, buildVersion, coverage);
      },
    );

    this.app.use(router.routes());
  }
}

// TODO make groupId required; w/o default
export function getAgentBuildKey(groupId: string = '', agentId: string, buildVersion: string): AgentKey {
  return `${groupId}_${agentId}_${buildVersion}` as AgentKey;
}

export function agentConfigToBuildKey(agentConfig: AgentConfig): AgentKey {
  const { serviceGroupId: groupId, id: agentId, buildVersion } = agentConfig;
  return getAgentBuildKey(groupId, agentId, buildVersion);
}
