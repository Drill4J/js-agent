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
import parseJsonRecursive from '@util/parse-json-recursive';
import { Message, AgentInfo } from '../agent/types';

const AgentStatus = {
  NOT_REGISTERED: 'NOT_REGISTERED',
  REGISTERED: 'REGISTERED',
  REGISTERING: 'REGISTERING',
  PREREGISTERED: 'PREREGISTERED',
};

export async function get(): Promise<unknown[]> {
  const connection = await connect();
  const agentsInfo = await getData(connection);
  const result = agentsInfo
    .filter(x => x.agentStatus === AgentStatus.REGISTERED)
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
  return result;
}

async function connect() {
  const token = await getAuthToken();
  const protocol = process.env.DRILL_ADMIN_IS_SECURE_CONNECTION == 'true' ? 'wss' : 'ws';
  const socketApiUrl = `${protocol}://${process.env.DRILL_ADMIN_HOST}/ws/drill-admin-socket?token=${token}`;
  const connection = new Websocket(socketApiUrl);
  await socketEvent(connection, 'open');
  return connection;
}

async function getAuthToken() {
  const protocol = process.env.DRILL_ADMIN_IS_SECURE_CONNECTION == 'true' ? 'https' : 'http';
  const url = `${protocol}://${process.env.DRILL_ADMIN_HOST}/api`;
  try {
    const response = await axios.post(`${url}/sign-in`, {
      username: process.env.DRILL_ADMIN_USERNAME,
      password: process.env.DRILL_ADMIN_PASSWORD,
    });
    if (response && response.status !== 200) throw new Error(`Response failed with the status: ${response.status}`);
    return response.headers.authorization;
  } catch (e) {
    throw new Error(
      'Failed to authorize in Drill4J Admin Backend service.' +
        '\n\t' +
        `Reason: ${e.message ? e.message : 'unknown'}` +
        '\n\t' +
        'Please check the following env variables to contain appropriate values:' +
        '\n\t\t' +
        `DRILL_ADMIN_IS_SECURE_CONNECTION = ${process.env.DRILL_ADMIN_IS_SECURE_CONNECTION}` +
        '\n\t\t' +
        `DRILL_ADMIN_HOST = ${process.env.DRILL_ADMIN_HOST}` +
        '\n\t\t' +
        `DRILL_ADMIN_USERNAME = ${process.env.DRILL_ADMIN_USERNAME}` +
        '\n\t\t' +
        `DRILL_ADMIN_PASSWORD = ${process.env.DRILL_ADMIN_PASSWORD}` +
        '\n\t' +
        'If everything looks correct make sure Drill4J Admin Backend API is running and reachable',
    );
  }
}

const isJsAgent = x => String(x.agentType).toLowerCase() === 'node.js';

async function getData(connection) {
  const agents = await socketMessageRequest<AgentInfo[]>(connection, '/api/agents');
  return Promise.all(agents.filter(isJsAgent).map(populateBuildData(connection)));
}

const populateBuildData = connection =>
  async function (agentData: any): Promise<any> {
    const { buildVersion, buildStatus, systemSettings } = await getLatestBuild(connection, agentData.id);
    return {
      ...agentData,
      buildVersion,
      status: buildStatus,
      systemSettings,
    };
  };

async function getLatestBuild(connection, agentId): Promise<any> {
  const data = await socketMessageRequest(connection, `/api/agent/${agentId}/builds`);
  const latestBuild = Array.isArray(data) && data[0];
  if (!latestBuild) {
    throw new Error(`Agent ${agentId} - failed to obtain build info`);
  }
  return latestBuild;
}

async function socketEvent(connection, event, timeout = 10000): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    connection.on(event, (...args: unknown[]) => {
      resolve(args);
    });
    setTimeout(() => reject(new Error(`await socket event ${event}: timeout of ${timeout}ms exceeded`)), timeout);
  });
}

async function socketMessageRequest<T>(connection, destination: string, timeout = 10000): Promise<T> {
  const responsePromise = new Promise<any>((resolve, reject) => {
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
