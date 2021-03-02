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
// eslint-disable-next-line import/no-unresolved
import { StartSessionPayload } from '@drill4j/test2code-types';
import { LocalStorage } from 'node-localstorage';
import { BundleScriptNames } from 'services/plugin/test2code/processors/coverage/types';

export class Storage {

  private storage: any;

  public init() {
    this.storage = new LocalStorage('./storage', Number(process.env.LOCAL_FILES_SIZE_QUOTA_MB) * 1024 * 1024);
  }

  public saveBundleMeta(agentId: string, data) {
    this.upsertToStorage('bundlemeta', { agentId, data }, { agentId });
  }

  public getBundleMeta(agentId: string): any {
    return this.getFromStorage('bundlemeta', { agentId })?.data;
  }

  // #region AST
  public saveAst(agentId: string, data) {
    this.upsertToStorage('ast', { agentId, data }, { agentId });
  }

  public getAst(agentId: string): any {
    return this.getFromStorage('ast', { agentId });
  }

  // public async cleanAst() {
  //   await this.removeFromStorage('ast');
  // }

  // #endregion

  // #region Coverage

  public saveCoverage(data) {
    this.saveToStorage('coverage', data);
  }

  public getCoverage(buildVersion): Promise<any[]> {
    return this.getFromStorage('coverage', { buildVersion });
  }

  // public cleanCoverageData() {
  //   this.removeFromStorage('coverage');
  // }

  // #endregion

  // #region sessionId
  public saveSession(agentId: string, id: string, data: StartSessionPayload) {
    this.saveToStorage('session', { agentId, id, data }); // TODO type session
  }

  public getSession(agentId: string, id: string): any | undefined {
    return this.getFromStorage('session', { agentId, id });
  }

  public removeSession(agentId: string, id: string) {
    this.removeFromStorage('session', { agentId, id });
  }

  public deleteSessions(agentId: string) {
    this.removeFromStorage('session', { agentId });
  }

  public cleanSession(agentId: string) {
    this.removeFromStorage('session', { agentId });
  }
  // #endregion

  // #region sourcemaps (mainScriptNames)
  public saveBundleScriptsNames(agentId: string, names: string[]) {
    this.upsertToStorage('scriptnames', { agentId, names }, { agentId });
  }

  public getBundleScriptsNames(agentId: string): Promise<BundleScriptNames> {
    return this.getFromStorage('scriptnames', { agentId })?.names;
  }

  // public cleanMainScriptNames() {
  //   this.removeFromStorage('scriptnames');
  // }
  // #endregion

  // #region db interaction // TODO abstract db interaction

  private saveToStorage(collection, data): void {
    this.storage.setItem(getStorageKey(collection, data.agentId), JSON.stringify(data));
  }

  private upsertToStorage(collection, data, query): void {
    this.storage.setItem(getStorageKey(collection, query?.agentId), JSON.stringify(data));
  }

  public findAll(collection, query) {
    return this.getFromStorage(collection, query);
  }

  public save(collection, data) {
    return this.saveToStorage(collection, data);
  }

  private getFromStorage(collection, query): any {
    return JSON.parse(this.storage.getItem(getStorageKey(collection, query?.agentId)))
  }

  private removeFromStorage(collection, query): void {
    this.storage.removeItem(getStorageKey(collection, query?.agentId))
  }
  // #endregion
}

const storage = new Storage();
export default storage;

function getStorageKey (collectionName: string, id: string): string {
  return  `${collectionName}-${id}`;
}
