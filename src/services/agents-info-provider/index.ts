import Websocket from 'ws';
import axios from 'axios';
import parseJsonRecursive from '../../util/parse-json-recursive';
import { Message, AgentInfo } from '../agent/types';

export async function get(): Promise<unknown[]> {
  const connection = await connect();
  const agentsInfo = await getData(connection);
  return agentsInfo.map(x => ({
    data: {
      id: x.id,
      instanceId: '',
      buildVersion: x.buildVersion,
      serviceGroupId: '',
      agentType: 'NODEJS',
    },
    plugins: x.plugins.map(p => ({ id: p.id })),
  }));
}

async function connect() {
  const token = await getAuthToken();
  const socketApiUrl = `ws://${process.env.DRILL_ADMIN_HOST}/ws/drill-admin-socket?token=${token}`;
  const connection = new Websocket(socketApiUrl);
  await socketEvent(connection, 'open');
  return connection;
}

async function getAuthToken() {
  // TODO add non-hardcoded protocol & https support
  const url = `http://${process.env.DRILL_ADMIN_HOST}/api`;
  const response = await axios.post(`${url}/login`);
  if (response.status !== 200) {
    throw new Error('failed to authorize');
  }
  return response.headers.authorization;
}

async function getData(connection) {
  const agentsData = (await socketMessageRequest(connection, 'api/agents')) as AgentInfo[];
  if (Array.isArray(agentsData)) {
    const jsAgents = agentsData.filter(x => String(x.agentType).toLowerCase() === 'node.js');
    return jsAgents;
  }
  throw new Error('failed to fetch agents data');
}

async function socketEvent(connection, event, timeout = 10000): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    connection.on(event, (...args: unknown[]) => {
      resolve(args);
    });
    setTimeout(() => reject(new Error(`await socket event ${event}: timeout of ${timeout}ms exceeded`)), timeout);
  });
}

async function socketMessageRequest(connection, destination: string, timeout = 10000): Promise<unknown> {
  const responsePromise = new Promise<unknown>((resolve, reject) => {
    connection.on('message', async (rawMessage: string) => {
      const message = parseJsonRecursive(rawMessage) as Message;
      if (message.type !== 'MESSAGE') {
        reject(new Error(`socket message request to ${destination} failed: ${message.type}`));
      } else if (message.type === 'MESSAGE' && message.destination === destination) {
        resolve(message.message);
        await connection.send(JSON.stringify({ destination, type: 'UNSUBSCRIBE' }));
      }
    });
    setTimeout(() => reject(new Error(`socket message request to ${destination} failed: timeout of ${timeout}ms exceeded`)), timeout);
  });
  await connection.send(JSON.stringify({ destination, type: 'SUBSCRIBE' }));
  return responsePromise;
}
