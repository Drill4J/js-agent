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

import { AgentConfig, AstEntity, ExecClassData } from '@drill4j/test2code-types';
import axios from 'axios';

export default { sendInstance, sendClassMetadata, sendClassMetadataCompleted, sendCoverage };

async function sendInstance(groupId: string, agentId: string, buildVersion: string, instanceId: string, data: AgentConfig) {
  await axios.put(`/groups/${groupId}/agents/${agentId}/builds/${buildVersion}/instances/${instanceId}`, JSON.stringify(data));
}

async function sendCoverage(groupId: string, agentId: string, buildVersion: string, instanceId: string, data: ExecClassData[]) {
  await axios.post(
    `/groups/${groupId}/agents/${agentId}/builds/${buildVersion}/instances/${instanceId}/coverage`,
    JSON.stringify({
      execClassData: data,
    }),
  );
}

async function sendClassMetadata(groupId: string, agentId: string, buildVersion: string, instanceId: string, data: AstEntity[]) {
  await axios.post(
    `/groups/${groupId}/agents/${agentId}/builds/${buildVersion}/instances/${instanceId}/class-metadata`,
    JSON.stringify({ astEntities: data }),
  );
}

// TODO delete once t2c is removed from admin
async function sendClassMetadataCompleted(groupId: string, agentId: string, buildVersion: string, instanceId: string) {
  // empty object is to be serialized to AgentMessage
  await axios.post(
    `/groups/${groupId}/agents/${agentId}/builds/${buildVersion}/instances/${instanceId}/class-metadata/complete`,
    JSON.stringify({}),
  );
}
