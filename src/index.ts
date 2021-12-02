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
import Websocket from 'ws';
import { App } from './app';
import storage from './storage';
import { AgentHubConfig } from './services/hub/types';
import { AgentHub } from './services/hub';
import LoggerProvider from './util/logger'; // TODO path aliases
import * as AgentsInfoProvider from './services/agents-info-provider';

const startupLogger = LoggerProvider.getLogger('startup');

async function start(): Promise<void> {
  startupLogger.info('starting');

  await storage.init();

  const agentHubConfig: AgentHubConfig = {
    loggerProvider: LoggerProvider,
    agentConfig: {
      loggerProvider: LoggerProvider,
      connection: {
        protocol: process.env.DRILL_ADMIN_PROTOCOL || 'ws',
        host: process.env.DRILL_ADMIN_HOST,
        Provider: Websocket,
      },
    },
  };
  const agentHub = new AgentHub(AgentsInfoProvider, agentHubConfig);
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
