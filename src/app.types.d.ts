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
import { ILoggerProvider } from './util/logger';
import { Agent } from './services/agent';
import { Test2CodePlugin } from './services/plugin/test2code';

declare module 'koa' {
  interface ExtendableContext {
    state: {
      drill: {
        agent: Agent;
        test2Code?: Test2CodePlugin;
      };
    };
  }
}

export interface AppConfig {
  port: number;
  body?: {
    json?: { limit: string };
    urlencoded?: { limit: string };
  };
  loggerProvider: ILoggerProvider;
}
