import WebSocket from 'ws';
/* eslint-disable import/no-unresolved */ // TODO configure local-module-first resolution (for development purposes)
import { AstEntity, InitActiveScope, InitScopePayload } from '@drill4j/test2code-types';

export class AgentService {
  private SocketTransport: SocketTransport;

  private config: Config;

  private connection: Connection;

  private astEntities: AstEntity[];

  private needSync: boolean;

  // TODO could've used ScopeSummary from @drill4j/test2code-types, but INIT_ACTIVE_SCOPE actual payoad lacks required "started" property
  private activeScope: Scope;

  constructor(transport: SocketTransport, config: Config) {
    this.SocketTransport = transport;
    this.config = config;
  }

  public init(astEntities: AstEntity[], needSync = true): void {
    console.log('AgentService init...');
    this.astEntities = astEntities;
    this.needSync = needSync;
    this.initConnection();
  }

  private initConnection() {
    const url = `${this.config.connection.protocol}://${this.config.connection.host}/agent/attach`;
    const options = {
      headers: {
        AgentConfig: JSON.stringify(this.config.agent),
        needSync: this.needSync, // TODO make sure that needSync='false' affects ONLY new scope creation and does not break anything
      },
    };
    // TODO what if we already have an open connection, should we re-use it or gracefully shutdown?
    this.connection = new this.SocketTransport(url, options);

    if (process.env.DEBUG_AGENT_SERVICE_CONNECTION === 'true') {
      this.connection._on = this.connection.on;
      this.connection.on = (event, handler) => {
        const wrappedHandler = (...args) => {
          console.log('AgentService EVENT', event, args);
          handler.apply(this, args);
        };
        this.connection._on(event, wrappedHandler);
      };
    }

    this.initHandlers();
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

  private initHandlers() {
    this.connection.on('message', (message) => this.handleMessage(String(message)));

    this.connection.on('open', () => {
      console.log('AgentService established connection!');
    });

    this.connection.on('close', () => {
      console.error('AgentService lost connection!');
    });
  }

  private setActiveScope(payload: InitScopePayload) {
    const { id, name } = payload;
    this.activeScope = {
      id,
      name,
    };
    // storage.deleteSessions({activeScope: { id }}]});
  }

  private handleMessage(rawMessage: string) {
    const data = this.parse(rawMessage);
    if (!data) return;

    const { destination } = data;
    this.sendDeliveryConfirmation(destination);

    if (destination === '/agent/load') {
      this.initTest2Code();
      // TODO why this particular confirmation requires manual formatting? (and not just sendDeliveryConfirmation(destination) like others)
      this.sendDeliveryConfirmation('/agent/plugin/test2code/loaded');
      return;
    }
    if (destination === '/plugin/action') {
      this.handlePluginAction(data.text);
      return;
    }
    console.log(`received message for unknown destination.\n  Destination: ${destination}\n  Message: ${JSON.stringify(data)}`);
  }

  private handlePluginAction(rawAction: string) {
    const data = this.parse(rawAction);
    if (!data) return;

    const { id, message } = data;
    if (id === 'test2code') {
      this.handleTest2CodeAction(message);
      return;
    }
    console.log(`receieved message for unknown plugin.\n  Plugin id: ${id}\n  Message: ${JSON.stringify(message)}`);
  }

  private initTest2Code() {
    const initInfo = {
      type: 'INIT',
      classesCount: 0, // TODO is it ok to just set 0 here?
      message: '',
      init: true,
    };
    this.sendToPlugin(this.config.plugin.id, initInfo);

    if (this.needSync) {
      this.sendToPlugin(this.config.plugin.id, {
        type: 'INIT_DATA_PART',
        astEntities: this.astEntities,
      });
    }

    // TODO should wait response for INIT or INIT_DATA_PART first ?
    this.sendToPlugin(this.config.plugin.id, { type: 'INITIALIZED', msg: '' });
  }

  private handleTest2CodeAction(rawAction: string) {
    const action = this.parse(rawAction);

    if (this.isInitActiveScopeAction(action)) {
      console.log('init active scope', action.payload);
      this.setActiveScope(action.payload);
      return;
    }
    console.log(`test2code: received unknown action.\n  Action: ${JSON.stringify(action)}`);
  }

  isInitActiveScopeAction(action: InitActiveScope): action is InitActiveScope {
    return (action as InitActiveScope).type === 'INIT_ACTIVE_SCOPE';
  }

  private parse(message): any | void {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log(`received malformed message.\n  Error: ${e}\n  Original message: ${message}`);
    }
    return data;
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

interface Scope {
  id: string,
  name: string,
}

interface Connection {
  on(event: string, handler: Handler): unknown;
  _on?(event: string, handler: Handler): unknown;
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
