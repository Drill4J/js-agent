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
declare module '@drill4j/test2code-types' {
  // INSTANCE
  export type AgentConfig = {
    id: string;
    instanceId: string;
    buildVersion: string;
    serviceGroupId?: string;

    // TODO send normal agent type
    agentType: 'NODEJS';
    // TODO send actual version (js-agent + js-parser?)
    agentVersion: '';

    // TODO add
    // buildMetadata: Record<string, any>;

    // TODO remove once made sure Admin Backend accepts AgenteConfig w/o these fields
    // val packagesPrefixes: PackagesPrefixes = PackagesPrefixes(),
    // val parameters: Map<String, AgentParameter> = emptyMap()
  };

  // AST
  export type AstEntity = {
    path: string;
    name: string;
    methods: AstMethod[];
  };
  export type AstMethod = {
    name: string;
    params: string[];
    returnType: string;
    count: number;
    checksum: string;
    // val probes: List<Int> = emptyList(),
  };

  // COVERAGE
  export type ExecClassData = {
    id: number;
    className: string;
    probes: boolean[];
    testId: string;
    sessionId: string;
  };

  // incoming V8 coverage
  export type AddSessionData = {
    type: 'ADD_SESSION_DATA';
    payload: SessionDataPayload;
  };
  export type SessionDataPayload = {
    sessionId: string;
    data: string;
  };
}
