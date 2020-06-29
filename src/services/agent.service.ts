import WebSocket from 'ws';
/* eslint-disable import/no-unresolved */ // TODO configure local-module-first resolution (for development purposes)
import { AstEntity } from '@drill4j/test2code-types';

export class AgentService {
  private SocketTransport: SocketTransport;

  private config: Config;

  private connection: Connection;

  constructor(transport: SocketTransport, config: Config) {
    this.SocketTransport = transport;
    this.config = config;
  }

  // TODO should probably move both astEntities and needSync to this.*something*Config in case any of these can be swapped on-the-fly
  public init(astEntities: AstEntity[], needSync = true): void {
    console.log('AgentService init...');
    const url = `${this.config.connection.protocol}://${this.config.connection.host}/agent/attach`;
    const options = {
      headers: {
        AgentConfig: JSON.stringify(this.config.agent),
        needSync, // TODO make sure that needSync='false' affects ONLY new scope creation and does not break anything
      },
    };
    // TODO what if we already have an open connection, should we re-use it or gracefully shutdown?
    this.connection = new this.SocketTransport(url, options);
    this.initHandlers(astEntities, needSync);
  }

  public sendToPlugin(pluginId: string, msg: unknown): void {
    const data = {
      type: 'PLUGIN_DATA',
      text: JSON.stringify({
        pluginId,
        drillMessage: { content: JSON.stringify(msg) },
      }),
    };
    this.send(data);
  }

  private initHandlers(astEntities: AstEntity[], needSync: boolean) {
    this.connection.on('message', async (message: string) => {
      const { destination } = JSON.parse(message);
      this.sendDeliveryConfirmation(destination);

      if (destination === '/agent/load') {
        const initInfo = {
          type: 'INIT',
          classesCount: 0, // TODO is it ok to just set 0 here?
          message: '',
          init: true,
        };
        this.sendToPlugin(this.config.plugin.id, initInfo);
        if (needSync) {
          this.sendToPlugin(this.config.plugin.id, {
            type: 'INIT_DATA_PART',
            astEntities,
          });
        }
        this.sendToPlugin(this.config.plugin.id, { type: 'INITIALIZED', msg: '' });
        this.sendDeliveryConfirmation('/agent/plugin/test2code/loaded');
      }
    });

    this.connection.on('open', () => {
      console.log('AgentService established connection!');
    });

    this.connection.on('close', () => {
      console.error('AgentService lost connection!');
    });
  }

  private send(data: DataPackage | ConfirmationPackage): void {
    const stringData = JSON.stringify(data);
    this.connection.send(stringData);
  }

  private sendDeliveryConfirmation(destination: string): void {
    const delivered = {
      type: 'MESSAGE_DELIVERED',
      destination,
    };
    this.send(delivered);
  }
}

const config = {
  agent: {
    id: process.env.AGENT_ID || 'Drill JS agent',
    instanceId: process.env.AGENT_INSTANCE_ID || '', // TODO what is that for and how it should be configured
    buildVersion: process.env.AGENT_BUILD_VERSION || '0.1.0', // TODO what is that for and how it should be configured
    serviceGroupId: process.env.AGENT_SERVICE_GROUP_ID || '', // TODO what is that for and how it should be configured
    agentType: process.env.AGENT_TYPE || 'NODEJS',
  },
  plugin: {
    id: process.env.PLUGIN_ID || 'test2code',
  },
  connection: {
    protocol: process.env.DRILL_ADMIN_PROTOCOL || 'ws',
    host: process.env.DRILL_ADMIN_HOST,
  },
};

export const agentService = new AgentService(WebSocket, config);

// TODO configure d.ts resolution and move types to either individual files or module

interface Config {
  agent: {
    id: string,
    instanceId: string,
    buildVersion: string,
    serviceGroupId: string,
    agentType: string
  },
  plugin: {
    id: string,
  },
  connection: {
    protocol: string,
    host: string,
  }
}

interface Connection {
  on(event: string, handler: Handler): unknown;
  send(data: string): unknown; // TODO set data type to Package
}

interface SocketTransport {
  new(url: string, options: any): Connection; // TODO decsribe options
}

type Handler = (...args: unknown[]) => unknown;

interface Package {
  type: string, // TODO describe type enum
}

interface ConfirmationPackage extends Package {
  destination: string,
}

interface DataPackage extends Package {
  text: string,
}
