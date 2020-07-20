import { PluginConfig } from './plugin.types';
import { Connection } from './agent.hub.types';

export interface PluginConstructor {
  new(pluginId: string, agentId: string, connection: Connection, config: PluginConfig): Plugin
}

export interface AvailablePlugins {
  [pluginId: string]: PluginConstructor
}

export interface Plugins {
  [pluginId: string]: Plugin
}

export class Plugin {
  protected id: string;

  protected agentId: string;

  protected config: PluginConfig;

  protected logger: any;
  // protected initialized: boolean;

  // protected initializing: Promise<unknown>;

  private connection: Connection;

  constructor(id: string, agentId: string, connection: Connection, config: PluginConfig) {
    this.id = id;
    this.agentId = agentId;
    this.connection = connection;
    this.config = config;
    this.logger = this.config.loggerProvider.getLogger('drill', `agent:${agentId}:${this.id}`);
  }

  public async init() { throw new Error(`${this.id} init not implemented`); }

  public hasMatchingId(someId: string) {
    return this.id === someId;
  }

  public handleAction(data) {
    throw new Error(`${this.id} handle action not implemented`);
  }

  protected send(message) {
    this.logger.silly('send %O', message);
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
