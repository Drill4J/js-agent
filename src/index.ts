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
import axios from 'axios';
import { App } from './app';
import LoggerProvider from './util/logger'; // TODO path aliases
import { version } from '../package.json';
import './util/performance';

console.log('js-agent version:', version);

const startupLogger = LoggerProvider.getLogger('startup');

async function start(): Promise<void> {
  startupLogger.info('starting');

  await setupAxios(process.env.DRILL_ADMIN_ADDRESS, process.env.DRILL_API_KEY);

  const app = new App({
    port: Number(process.env.APP_PORT) || 8080,
    loggerProvider: LoggerProvider,
  });
  await app.start();
}

async function setupAxios(adminAddress: string, apiKey: string) {
  axios.defaults.baseURL = `${adminAddress}/api`;
  axios.defaults.headers.common['X-Api-Key'] = apiKey;

  // TODO remove once Admin Backend learns to parse 'application/json; encoding: utf-8'
  axios.defaults.headers.post['Content-Type'] = 'application/json';
  axios.defaults.headers.put['Content-Type'] = 'application/json';
}

export default start();
