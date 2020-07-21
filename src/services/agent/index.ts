import {
  ConnectionProvider,
  Connection,
  DataPackage,
  ConfirmationPackage,
} from '../hub/types';
import { AgentData, AgentConfig } from './types';
import { isTest2CodePlugin } from '../plugin/guards';
import { Plugin, Plugins } from '../plugin';

export interface AgentsMap {
  [agentId: string]: Agent
}

export class Agent {
  private config: AgentConfig;

  private logger: any;

  private ConnectionProvider: ConnectionProvider;

  private connection: Connection;

  private needSync = false;

  readonly data: AgentData;

  private plugins: Plugins = {};

  public id: string;

  public initialized: boolean;

  public initializing: Promise<any>;

  constructor(agentData: AgentData, connectionProvider: ConnectionProvider, config: AgentConfig, needSync: boolean) {
    this.id = agentData.id;
    this.data = agentData;
    this.ConnectionProvider = connectionProvider;
    this.config = config;
    this.needSync = needSync;
    this.logger = this.config.loggerProvider.getLogger('drill', `agent:${agentData.id}`);
    this.initializing = this.init();
  }

  private async init() {
    this.logger.info('init');
    await this.initConnection();
    this.initialized = true;
  }

  private async initConnection() {
    try {
      // TODO add connection status check
      // TODO what if we already have an open connection, should we re-use it or gracefully shutdown?
      if (this.connection) {
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

      this.connection = new this.ConnectionProvider(url, options);

      if (process.env.DEBUG_AGENT_SERVICE_CONNECTION === 'true') {
        this.connection._on = this.connection.on;
        this.connection.on = (event, handler) => {
          const wrappedHandler = (...args) => {
            this.logger.debug(`event: ${event}\n    arguments:\n    ${args}`);
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
          return;
        }
        this.logger.info(`connection closed\n    reason ${reasonCode}\n    description${description}`);
      });

      this.connection.on('message', (message) => this.handleMessage(String(message)));

      await connectionEstablished;
    } catch (e) {
      const msg = `failed to establish connection!\n    error: ${e.message}\n    stack: ${e.stack}`;
      this.logger.error(msg);
      throw new Error(msg);
    }
  }

  public async stop() {
    if (this.connection.readyState === 1) { // TODO fix a magic number (it's referring to the state OPEN because enums are terrible)
      this.connection.close();
      await new Promise((resolve, reject) => {
        this.connection.on('close', () => resolve());
        const timeout = parseInt(process.env.AGENT_CLOSE_CONNECTION_TIMEOUT_MS, 10) || 10000;
        setTimeout(() => reject(new Error('failed to close connection')), timeout);
      });
    }
  }

  // TODO add try ... catch and await all async methods to avoid unhandled promise rejections
  private handleMessage(rawMessage: string) {
    const data = this.config.messageParseFunction(rawMessage);
    if (!data) return;

    const { destination } = data;
    this.sendDeliveryConfirmation(destination);

    if (destination === '/agent/load') {
      // HACK for non-Java agent implementation / sends signal to Java backend to load test2code plugin
      this.sendDeliveryConfirmation('/agent/plugin/test2code/loaded');
      return;
    }
    if (destination === '/plugin/togglePlugin') {
      const { message: { pluginId } } = data;
      this.togglePlugin(pluginId);
      return;
    }
    if (destination === '/plugin/action') {
      const { message: { id, message: action } } = data;
      const plugin = this.ensurePluginInstance(id);
      if (isTest2CodePlugin(plugin)) {
        plugin.handleAction(action);
      }
      return;
    }
    this.logger.debug(`received message for unknown destination.\n    destination: ${destination}\n    message: ${JSON.stringify(data)}`);
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

  public ensurePluginInstance(pluginId: string): Plugin {
    if (this.plugins[pluginId]) {
      return this.plugins[pluginId];
    }
    return this.instantiatePlugin(pluginId);
  }

  public getPluginInstance(pluginId: string): Plugin {
    const plugin = this.plugins[pluginId];
    if (!plugin) {
      const msg = `plugin ${pluginId} does not exist!`;
      this.logger.error(msg);
      throw new Error(msg);
    }
    return plugin;
  }

  private instantiatePlugin(pluginId: string): Plugin {
    this.logger.info('instantiate plugin', pluginId);
    const PluginClass = this.config.availablePlugins[pluginId];
    const plugin = new PluginClass(
      pluginId,
      this.id,
      this.connection,
      {
        loggerProvider: this.config.loggerProvider,
      },
    );
    this.plugins[pluginId] = plugin;
    return plugin;
  }

  public async togglePlugin(pluginId: string): Promise<void> {
    this.logger.debug('toggle plugin', pluginId);
    const plugin = this.ensurePluginInstance(pluginId);
    // Note that currently plugin.init() is called only once, only during registration process.
    // Startup after middleware reboot does not require repeated plugin.init() call
    // because plugin is already "initiated" at drill backend.
    await plugin.init();
  }

  public checkUniqueBuildVersion(buildVersion: string): void {
    if (this.data.buildVersion === buildVersion) {
      this.logger.warning(`build version ${buildVersion} matches existing version!`);
    }
  }

  public getPluginsIds(): string[] {
    return Object.keys(this.plugins);
  }
}
