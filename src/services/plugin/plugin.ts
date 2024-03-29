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
import { PluginConfig } from './types';
import { Connection } from '../common/types';

export default class Plugin {
  protected id: string;

  protected agentId: string;

  protected currentBuildVersion: string;

  protected config: PluginConfig;

  protected logger: any;

  private connection: Connection;

  constructor(id: string, agentId: string, currentBuildVersion: string, connection: Connection, config: PluginConfig) {
    this.id = id;
    this.agentId = agentId;
    this.currentBuildVersion = currentBuildVersion;
    this.connection = connection;
    this.config = config;
    this.logger = this.config.loggerProvider.getLogger('agent', agentId, this.id);
  }

  public async init() {
    throw new Error(`${this.id} init not implemented`);
  }

  public hasMatchingId(someId: string) {
    return this.id === someId;
  }

  public handleAction(data) {
    throw new Error(`${this.id} handle action not implemented`);
  }

  protected send<T>(message: T) {
    const argsString = JSON.stringify(message);
    const maxArgsLength = parseInt(process.env.DEBUG_AGENT_SERVICE_CONNECTION_MAX_ARGS_LENGTH, 10) || 2000;
    this.logger.silly(
      `send ${argsString.length <= maxArgsLength ? message : `${argsString.substring(0, maxArgsLength)}...message too long...`}`,
    );
    const data = {
      type: 'PLUGIN_DATA',
      text: JSON.stringify({
        pluginId: this.id,
        drillMessage: { content: JSON.stringify(message) },
      }),
    };
    const stringData = JSON.stringify(data);
    this.connection.send(stringData);
  }
}
