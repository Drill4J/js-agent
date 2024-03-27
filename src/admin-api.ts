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

export default { sendInstance, sendClassMetadata, sendCoverage };

async function sendInstance(instanceId: string, data: AgentConfig) {
  await axios.put(`/instances/${instanceId}`, JSON.stringify(data));
}

async function sendCoverage(instanceId: string, data: ExecClassData[]) {
  await axios.post(
    `/instances/${instanceId}/coverage`,
    JSON.stringify({
      execClassData: data,
    }),
  );
}

async function sendClassMetadata(instanceId: string, data: AstEntity[]) {
  await axios.post(`/instances/${instanceId}/class-metadata`, JSON.stringify({ astEntities: data }));
}
