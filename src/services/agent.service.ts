import WebSocket from 'ws';

import { DRILL_ADMIN_HOST, TEST2CODE_PLUGINID } from '../constants';
// eslint-disable-next-line import/no-cycle
import { toPluginMessage } from './plugin.service';
import { getFormattedAstTree } from './ast.service';

const DRILL_AGENT_CONFIG = {
  id: 'Drill JS agent',
  instanceId: '',
  buildVersion: '0.1.0',
  serviceGroupId: '',
  agentType: 'NODEJS',
};

class AgentSocket {
  public connection: WebSocket;

  public init() {
    this.connection = new WebSocket(
      `ws://${DRILL_ADMIN_HOST}/agent/attach`,
      {
        headers: {
          AgentConfig: JSON.stringify(DRILL_AGENT_CONFIG),
          needSync: 'true',
        },
      },
    ).on('message', (message: string) => {
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
          astEntities: getFormattedAstTree(),
        })));
        this.connection.send(toPluginMessage(TEST2CODE_PLUGINID, JSON.stringify({ type: 'INITIALIZED', msg: '' })));
        sendDeliveredConfirmation('/agent/plugin/test2code/loaded');
      }
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
