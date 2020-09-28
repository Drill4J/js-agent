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
  export interface ActiveScopeChangePayload {
    scopeName: string;
    savePrevScope?: boolean;
    prevScopeEnabled?: boolean;
  }
  export interface ActiveSessions {
    count: number;
    testTypes: string[];
  }
  export interface AgentSummaryDto {
    id: string;
    name: string;
    buildVersion: string;
    summary: SummaryDto;
  }
  export interface AssociatedTests {
    id: string;
    packageName?: string;
    className?: string;
    methodName?: string;
    tests?: TypedTest[];
  }
  export interface BuildCoverage {
    ratio: number;
    count: Count;
    methodCount: Count;
    riskCount: Count;
    byTestType: { [key: string]: TestTypeSummary };
    diff: number;
    prevBuildVersion: string;
    arrow: 'INCREASE' | 'DECREASE' | null;
    finishedScopesCount: number;
  }
  export interface BuildMethods {
    totalMethods?: MethodsInfo;
    newMethods?: MethodsInfo;
    modifiedNameMethods?: MethodsInfo;
    modifiedDescMethods?: MethodsInfo;
    modifiedBodyMethods?: MethodsInfo;
    allModifiedMethods?: MethodsInfo;
    unaffectedMethods?: MethodsInfo;
    deletedMethods?: MethodsInfo;
    deletedCoveredMethodsCount?: number;
  }
  export interface Count {
    covered: number;
    total: number;
  }
  export interface DropScope {
    type: 'DROP_SCOPE';
    payload: ScopePayload;
  }
  export interface JavaClassCoverage {
    id: string;
    name: string;
    path: string;
    totalMethodsCount?: number;
    totalCount?: number;
    coverage?: number;
    coveredMethodsCount?: number;
    assocTestsCount?: number;
    probes?: number[];
    methods: JavaMethodCoverage[];
  }
  export interface JavaMethod {
    ownerClass: string;
    name: string;
    desc: string;
    hash: string | null;
    coverageRate?: 'MISSED' | 'PARTLY' | 'FULL';
  }
  export interface JavaMethodCoverage {
    id: string;
    name: string;
    desc: string;
    decl: string;
    count: number;
    coverage?: number;
    probeRange?: ProbeRange;
    assocTestsCount?: number;
  }
  export interface JavaPackageCoverage {
    id: string;
    name: string;
    totalClassesCount?: number;
    totalMethodsCount?: number;
    totalCount?: number;
    coverage?: number;
    coveredClassesCount?: number;
    coveredMethodsCount?: number;
    assocTestsCount?: number;
    classes: JavaClassCoverage[];
  }
  export interface MethodsCoveredByTest {
    id: string;
    testName: string;
    testType: string;
    newMethods: JavaMethod[];
    modifiedMethods: JavaMethod[];
    unaffectedMethods: JavaMethod[];
  }
  export interface MethodsCoveredByTestType {
    testType: string;
    testsCount: number;
    newMethods: JavaMethod[];
    modifiedMethods: JavaMethod[];
    unaffectedMethods: JavaMethod[];
  }
  export interface MethodsInfo {
    totalCount?: number;
    coveredCount?: number;
    methods?: JavaMethod[];
  }
  export interface MethodsSummaryDto {
    all: Count;
    new: Count;
    modified: Count;
    deleted: Count;
  }
  export interface PackageTree {
    totalCount?: number;
    totalMethodCount?: number;
    packages?: JavaPackageCoverage[];
  }
  export interface ProbeRange {
    first: number;
    last: number;
  }
  export interface RenameScope {
    type: 'RENAME_SCOPE';
    payload: RenameScopePayload;
  }
  export interface RenameScopePayload {
    scopeId: string;
    scopeName: string;
  }
  export interface Risks {
    newMethods: JavaMethod[];
    modifiedMethods: JavaMethod[];
  }
  export interface ScopeCoverage {
    ratio: number;
    count: Count;
    methodCount: Count;
    riskCount: Count;
    byTestType: { [key: string]: TestTypeSummary };
  }
  export interface ScopePayload {
    scopeId?: string;
  }
  export interface ScopeSummary {
    name: string;
    id: string;
    started: number;
    finished?: number;
    enabled?: boolean;
    active?: boolean;
    coverage?: ScopeCoverage;
  }
  export interface ServiceGroupSummaryDto {
    name: string;
    aggregated: SummaryDto;
    summaries: AgentSummaryDto[];
  }
  export interface StartNewSession {
    type: 'START';
    payload: StartPayload;
  }
  export interface SummaryDto {
    coverage: number;
    coverageCount: Count;
    arrow: 'INCREASE' | 'DECREASE' | null;
    risks: number;
    testsToRun: TestsToRunDto;
  }
  export interface SwitchActiveScope {
    type: 'SWITCH_ACTIVE_SCOPE';
    payload: ActiveScopeChangePayload;
  }
  export interface TestsToRun {
    testTypeToNames: { [key: string]: string[] };
  }
  export interface TestsToRunDto {
    groupedTests: { [key: string]: string[] };
    count: number;
  }
  export interface TestsUsagesInfoByType {
    testType: string;
    coverage: number;
    methodsCount: number;
    tests: TestUsagesInfo[];
  }
  export interface TestTypeSummary {
    testType: string;
    coverage?: number;
    testCount?: number;
    coveredMethodsCount: number;
  }
  export interface TestUsagesInfo {
    id: string;
    testName: string;
    methodCalls: number;
    coverage: number;
  }
  export interface ToggleScope {
    type: 'TOGGLE_SCOPE';
    payload: ScopePayload;
  }
  export interface TypedTest {
    name: string;
    type: string;
  }
  export interface AllSessionsCancelled {
    type: 'ALL_SESSIONS_CANCELLED';
    ids: string[];
    ts: number;
  }
  export interface AstEntity {
    path: string;
    name: string;
    methods: AstMethod[];
    probes?: number[];
  }
  export interface AstMethod {
    name: string;
    params: string[];
    returnType: string;
    count?: number;
    probes?: number[];
  }
  export interface CancelSession {
    type: 'CANCEL';
    payload: SessionPayload;
  }
  export interface CoverConfig {
    message?: string;
  }
  export interface CoverDataPart {
    type: 'COVERAGE_DATA_PART';
    sessionId: string;
    data: ExecClassData[];
  }
  export interface ExecClassData {
    id: number;
    className: string;
    probes: boolean[];
    testName?: string;
  }
  export interface InitActiveScope {
    type: 'INIT_ACTIVE_SCOPE';
    payload: InitScopePayload;
  }
  export interface InitDataPart {
    type: 'INIT_DATA_PART';
    astEntities: AstEntity[];
  }
  export interface Initialized {
    type: 'INITIALIZED';
    msg?: string;
  }
  export interface InitInfo {
    type: 'INIT';
    classesCount: number;
    message: string;
    init?: boolean;
  }
  export interface InitScopePayload {
    id: string;
    name: string;
    prevId: string;
  }
  export interface ScopeInitialized {
    type: 'SCOPE_INITIALIZED';
    id: string;
    name: string;
    prevId: string;
    ts: number;
  }
  export interface SessionCancelled {
    type: 'SESSION_CANCELLED';
    sessionId: string;
    ts: number;
  }
  export interface SessionChanged {
    type: 'SESSION_CHANGED';
    sessionId: string;
    probeCount: number;
  }
  export interface SessionFinished {
    type: 'SESSION_FINISHED';
    sessionId: string;
    ts: number;
  }
  export interface SessionPayload {
    sessionId: string;
  }
  export interface SessionStarted {
    type: 'SESSION_STARTED';
    sessionId: string;
    testType: string;
    ts: number;
  }
  export interface StartPayload {
    testType?: string;
    sessionId?: string;
  }
  export interface StartSession {
    type: 'START_AGENT_SESSION';
    payload: StartSessionPayload;
  }
  export interface StartSessionPayload {
    sessionId: string;
    startPayload: StartPayload;
  }
  export interface StopSession {
    type: 'STOP';
    payload: SessionPayload;
  }
}
