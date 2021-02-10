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
import Websocket from 'ws';
import axios from 'axios';
import parseJsonRecursive from '../../util/parse-json-recursive';
import { Message, AgentInfo } from '../agent/types';

const AgentStatus = {
  ONLINE: 'ONLINE',
  NOT_REGISTERED: 'NOT_REGISTERED',
  OFFLINE: 'OFFLINE',
  BUSY: 'BUSY',
};

export async function get(): Promise<unknown[]> {
  const connection = await connect();
  const agentsInfo = await getData(connection);
  return agentsInfo
    .filter(x => x.status === AgentStatus.OFFLINE)
    .map(x => ({
      data: {
        id: x.id,
        instanceId: '',
        buildVersion: x.buildVersion,
        serviceGroupId: x.group,
        agentType: 'NODEJS',
      },
      plugins: x.plugins.map(p => ({ id: p.id })),
    }));
}

async function connect() {
  const token = await getAuthToken();
  const socketApiUrl = `${process.env.DRILL_ADMIN_PROTOCOL}://${process.env.DRILL_ADMIN_HOST}/ws/drill-admin-socket?token=${token}`;
  const connection = new Websocket(socketApiUrl);
  await socketEvent(connection, 'open');
  return connection;
}

async function getAuthToken() {
  // TODO add non-hardcoded protocol & https support
  const url = `${process.env.DRILL_ADMIN_PROTOCOL}://${process.env.DRILL_ADMIN_HOST}/api`;
  const response = await axios.post(`${url}/login`);
  if (response.status !== 200) {
    throw new Error('failed to authorize');
  }
  return response.headers.authorization;
}

async function getData(connection) {
  const agentsData = (await socketMessageRequest(connection, '/api/agents')) as AgentInfo[];
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
