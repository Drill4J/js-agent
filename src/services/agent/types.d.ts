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
import { ILoggerProvider } from '@util/logger';
import { ConnectionProvider } from '../common/types';

export interface AgentData {
  id: string;
  agentType: 'NODEJS';
  instanceId: string; // TODO what is that for and how it should be configured
  buildVersion: string;
  serviceGroupId?: string;
  // buildMetadata: Record<string, any>;
}

export interface AgentConfig {
  loggerProvider: ILoggerProvider;
  connection: {
    protocol: string;
    host: string;
    Provider: ConnectionProvider;
  };
}

type MessageParseFunction = (rawMessage, ...args: unknown[]) => Message | void;

export interface Message {
  destination: string;
  type: string;
  message: any; // TODO type it
}

export interface AgentInfo {
  id: string;
  agentType: string;
  buildVersion: string;
  group?: string;
  instanceIds?: string[];
  plugins: PluginInfo[];
  agentStatus: 'NOT_REGISTERED' | 'PREREGISTERED' | 'REGISTERING' | 'REGISTERED';
}

export interface PluginInfo {
  id: string;
}
