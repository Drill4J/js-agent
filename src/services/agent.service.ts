import WebSocket from 'ws';

import { DRILL_ADMIN_HOST, TEST2CODE_PLUGINID } from '../constants';
// eslint-disable-next-line import/no-cycle
import { toPluginMessage } from './plugin.service';

const DRILL_AGENT_CONFIG = {
  id: 'Drill JS agent',
  instanceId: '',
  buildVersion: '0.1.0',
  serviceGroupId: '',
  agentType: 'NODEJS',
};

class AgentSocket {
  public connection: WebSocket;

  public init(astEntities, needSync = 'true') {
    console.log('AgentSocket init...');

    this.connection = new WebSocket(
      `ws://${DRILL_ADMIN_HOST}/agent/attach`,
      {
        headers: {
          AgentConfig: JSON.stringify(DRILL_AGENT_CONFIG),
          needSync, // TODO make sure that needSync='false' affects ONLY new scope creation and does not break anything
        },
      },
    );

    this.connection.on('message', async (message: string) => {
      const { destination } = JSON.parse(message);
      sendDeliveredConfirmation(destination);
      if (destination === '/agent/load') {
        const initInfo = JSON.stringify({
          type: 'INIT',
          classesCount: 0,
          message: '',
          init: true,
        });
        this.connection.send(toPluginMessage(TEST2CODE_PLUGINID, initInfo));
        this.connection.send(toPluginMessage(TEST2CODE_PLUGINID, JSON.stringify({
          type: 'INIT_DATA_PART',
          astEntities,
        })));
        this.connection.send(toPluginMessage(TEST2CODE_PLUGINID, JSON.stringify({ type: 'INITIALIZED', msg: '' })));
        sendDeliveredConfirmation('/agent/plugin/test2code/loaded');
      }
    });

    this.connection.on('open', () => {
      console.log('AgentSocket established connection!');
    });

    this.connection.on('close', () => {
      console.error('AgentSocket lost connection!');
    });
  }
}

export const agentSocket = new AgentSocket();

export function sendDeliveredConfirmation(destination: string): void {
  const delivered = {
    type: 'MESSAGE_DELIVERED',
    destination,
  };
  agentSocket.connection.send(JSON.stringify(delivered));
}
