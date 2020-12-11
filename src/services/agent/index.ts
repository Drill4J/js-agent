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
import { AgentData, AgentConfig, PluginInfo, Message } from './types';
import { Connection, DataPackage, ConfirmationPackage } from '../common/types';
import { isTest2CodePlugin } from '../plugin/guards';
import { Plugin, Plugins, IPluginConstructor } from '../plugin';
import parseJsonRecursive from '../../util/parse-json-recursive';

export interface AgentsMap {
  [agentId: string]: Agent;
}

enum CONNECTION_READY_STATE {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

export class Agent {
  private config: AgentConfig;

  private logger: any;

  private connection: Connection;

  private needSync = false;

  private data: AgentData;

  private plugins: Plugins = {};

  private enabledPlugins: PluginInfo[];

  public initialized: boolean;

  public initializing: Promise<any>;

  constructor(agentInfo: any, config: AgentConfig, needSync: boolean) {
    const { data, plugins = [] }: { data: AgentData; plugins: PluginInfo[] } = agentInfo;
    this.data = data;
    this.enabledPlugins = plugins;
    this.config = config;
    this.needSync = needSync;
    this.logger = this.config.loggerProvider.getLogger('drill', `agent:${agentInfo.data.id}`);
    this.initializing = this.start();
  }

  private async start() {
    this.logger.info('init %o', this.data);
    await this.openConnection();
    await this.instantiatePlugins();
    this.initialized = true;
  }

  private async stop(): Promise<void> {
    this.initialized = false;
    await this.removePlugins();
    await this.closeConnection();
  }

  private async openConnection() {
    try {
      if (this.connection && this.connection.readyState === CONNECTION_READY_STATE.OPEN) {
        const msg = 'connection is already established';
        this.logger.error(msg);
        throw new Error(msg); // TODO extend error to specify agent.id
      }

      const url = `${this.config.connection.protocol}://${this.config.connection.host}/agent/attach`;
      const options = {
        headers: {
          AgentConfig: JSON.stringify(this.data),
          needSync: this.needSync, // TODO find out what needSync really does
        },
      };

      this.connection = new this.config.connection.Provider(url, options);

      if (process.env.DEBUG_AGENT_SERVICE_CONNECTION === 'true') {
        this.connection._on = this.connection.on;
        this.connection.on = (event, handler) => {
          const wrappedHandler = (...args) => {
            const argsString = JSON.stringify(args);
            const maxArgsLength = parseInt(process.env.DEBUG_AGENT_SERVICE_CONNECTION_MAX_ARGS_LENGTH, 10) || 2000;
            this.logger.debug(
              `event: ${event}\n    arguments:\n    ${
                argsString.length <= maxArgsLength ? args : `${argsString.substring(0, maxArgsLength)}...args too long...`
              }`,
            );
            handler.apply(this, args);
          };
          this.connection._on(event, wrappedHandler);
        };
      }

      const connectionEstablished = new Promise((resolve, reject) => {
        this.connection.on('open', () => {
          this.logger.info('connection established');
          resolve();
        });
        const connectionTimeout = parseInt(process.env.AGENT_ESTABLISH_CONNECTION_TIMEOUT_MS, 10) || 10000;
        setTimeout(() => reject(), connectionTimeout);
      });

      this.connection.on('error', (...args) => {
        this.logger.error('connection error', ...args);
      });

      this.connection.on('close', (reasonCode: string, description: string) => {
        if (parseInt(reasonCode, 10) > 1000) {
          this.logger.error(`connection closed abnormally\n    reason ${reasonCode}\n    description${description}`);
          // TODO remove dangling agent instances from agent hub? (plugins will get discarded as well)
          return;
        }
        this.logger.info(`connection closed\n    reason ${reasonCode}\n    description${description}`);
      });

      this.connection.on('message', message => this.handleMessage(String(message)));

      await connectionEstablished;
    } catch (e) {
      const msg = `failed to establish connection!\n    error: ${e.message}\n    stack: ${e.stack}`;
      this.logger.error(msg);
      throw new Error(msg);
    }
  }

  private async closeConnection() {
    if (this.connection && this.connection.readyState === CONNECTION_READY_STATE.OPEN) {
      this.connection.close();
      await new Promise((resolve, reject) => {
        this.connection.on('close', () => resolve());
        const timeout = parseInt(process.env.AGENT_CLOSE_CONNECTION_TIMEOUT_MS, 10) || 10000;
        setTimeout(() => reject(new Error('failed to close connection')), timeout);
      });
    }
  }

  private async instantiatePlugins(): Promise<void> {
    if (this.enabledPlugins) {
      await Promise.all(this.enabledPlugins.map(pluginInfo => this.instantiatePlugin(pluginInfo.id)));
    }
  }

  private async removePlugins(): Promise<void> {
    // TODO think about the sequence of actions necessary to "stop" a plugin
    await Promise.all(Object.keys(this.plugins).map(pluginId => this.plugins[pluginId].stop()));
    this.plugins = {};
  }

  public async updateBuildVersion(agentData: AgentData): Promise<void> {
    this.logger.info('update build version data\n   old %o \n   new %o', this.data, agentData);

    this.checkUniqueBuildVersion(agentData.buildVersion);

    await this.stop();
    this.data = agentData;
    this.needSync = true;
    await this.start();
  }

  // TODO add try ... catch and await all async methods to avoid unhandled promise rejections
  private async handleMessage(rawMessage: string) {
    const data = parseJsonRecursive(rawMessage) as Message;
    if (!data) return;

    const { destination } = data;

    switch (destination) {
      case '/agent/load':
        // HACK for non-Java agent implementation / sends signal to Java backend to load test2code plugin
        this.sendDeliveryConfirmation('/agent/plugin/test2code/loaded');
        break;

      case '/plugin/togglePlugin': {
        const {
          message: { pluginId },
        } = data;
        await this.togglePlugin(pluginId);
        break;
      }

      case '/plugin/action': {
        const {
          message: { id, message: action },
        } = data;
        const plugin = await this.ensurePluginInstance(id);
        if (isTest2CodePlugin(plugin)) {
          await plugin.handleAction(action);
        }
        break;
      }

      default:
        this.logger.debug(
          `received message for unknown destination.\n    destination: ${destination}\n    message: ${JSON.stringify(data)}`,
        );
        break;
    }

    this.sendDeliveryConfirmation(destination);
  }

  private send(data: DataPackage | ConfirmationPackage): void {
    const stringData = JSON.stringify(data);
    this.logger.silly('send', stringData);
    this.connection.send(stringData);
  }

  private sendDeliveryConfirmation(destination: string): void {
    const delivered = {
      type: 'MESSAGE_DELIVERED',
      destination,
    };
    this.send(delivered);
  }

  public async ensurePluginInstance(pluginId: string): Promise<Plugin> {
    if (this.plugins[pluginId]) {
      return this.plugins[pluginId];
    }
    return this.instantiatePlugin(pluginId);
  }

  public checkPluginInstanceExistence(pluginId: string): void {
    const plugin = this.plugins[pluginId];
    if (!plugin) {
      const msg = `plugin ${pluginId} does not exist!`;
      this.logger.error(msg);
      throw new Error(msg);
    }
  }

  private async instantiatePlugin(pluginId: string): Promise<Plugin> {
    this.logger.info('instantiate plugin', pluginId);
    const PluginConstructor = await this.importPluginConstructor(pluginId);
    const plugin = new PluginConstructor(pluginId, this.data.id, this.connection, {
      loggerProvider: this.config.loggerProvider,
    });
    this.plugins[pluginId] = plugin;
    return plugin;
  }

  private async importPluginConstructor(rawPluginId: string): Promise<IPluginConstructor> {
    const pluginId = rawPluginId.toLowerCase().replace(/[^a-zA-Z-\d]/, '');
    if (pluginId !== rawPluginId) {
      const msg = 'Failed to import plugin: pluginId is missing or malformed. Only lowercase kebab-cased-names are allowed';
      this.logger.error(msg);
      throw new Error(msg);
    }
    try {
      const exportedMembers = await import(`../plugin/${pluginId}`);
      if (!exportedMembers.default) {
        throw new Error(`Plugin ${pluginId} has no member exported by default. Please, export default member to support dynamic imports.`);
      }
      return exportedMembers.default as IPluginConstructor;
    } catch (e) {
      this.logger.error(e.message);
      const msg = `Failed to import plugin with id ${pluginId}. Plugin is malformed or does not exist.`;
      this.logger.error(msg);
      throw new Error(msg);
    }
  }

  public async togglePlugin(pluginId: string): Promise<void> {
    this.logger.debug('toggle plugin', pluginId);

    const isPluginEnabled = this.enabledPlugins.findIndex(x => x.id.toLowerCase() === pluginId.toLowerCase()) > -1;
    if (!isPluginEnabled) {
      this.enabledPlugins.push({ id: pluginId });
    }

    const plugin = await this.ensurePluginInstance(pluginId);
    // Note that currently plugin.init() is called during registration process & build version update
    // Startup after middleware reboot does not require repeated plugin.init() call
    // because plugin is already "initiated" at drill backend.
    await plugin.init();
  }

  public checkUniqueBuildVersion(buildVersion: string): void {
    if (this.data.buildVersion === buildVersion) {
      this.logger.warning(`build version ${buildVersion} matches existing version!`);
    }
  }
}
