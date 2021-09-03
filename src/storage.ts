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
import { MongoClient } from 'mongodb';
import { BundleScriptNames } from './services/plugin/test2code/processors/coverage/types';

export interface StorageSettings {
  host: string;
  dbname: string;
}

export class Storage {
  private settings: StorageSettings;

  private db: any;

  constructor(host, dbname) {
    this.settings = {
      host,
      dbname,
    };
  }

  public async init() {
    this.db = await this.connect();
  }

  public async saveBundleMeta(agentId, buildVersion, data) {
    await this.upsertToDb('bundlemeta', { agentId, buildVersion, data }, { agentId, buildVersion });
  }

  public async getBundleMeta(agentId, buildVersion): Promise<any> {
    const res = await this.getFromDb('bundlemeta', { agentId, buildVersion });
    return res && res[0].data;
  }

  // #region AST
  public async saveAst(agentId, version, data) {
    await this.upsertToDb('ast', { agentId, version, data }, { agentId, version });
  }

  public async getAst(agentId, version): Promise<any> {
    const asts = await this.getFromDb('ast', { agentId, version });
    return asts && asts[0];
  }

  public async cleanAst() {
    await this.removeFromDb('ast');
  }

  // #endregion

  // #region Coverage

  public async saveCoverage(data) {
    await this.saveToDb('coverage', data);
  }

  public async getCoverage(buildVersion): Promise<any[]> {
    const coverages = await this.getFromDb('coverage', { buildVersion });
    return coverages;
  }

  public async cleanCoverageData() {
    await this.removeFromDb('coverage');
  }

  // #endregion

  // #region sessionId
  public async saveSession(agentId: string, id: string, data: StartSessionPayload) {
    await this.saveToDb('session', { agentId, id, data }); // TODO type session
  }

  public async getSession(agentId: string, id: string): Promise<any | undefined> {
    const sessions = await this.getFromDb('session', { agentId, id });
    return sessions && sessions[0];
  }

  public async removeSession(agentId: string, id: string) {
    await this.removeFromDb('session', { agentId, id });
  }

  public async deleteSessions(agentId: string) {
    await this.removeFromDb('session', { agentId });
  }

  public async cleanSession(agentId: string) {
    await this.removeFromDb('session', { agentId });
  }
  // #endregion

  // #region sourcemaps (mainScriptNames)
  public async saveBundleScriptsNames(agentId, buildVersion, names) {
    await this.upsertToDb('scriptnames', { agentId, buildVersion, names }, { agentId, buildVersion });
  }

  public async getBundleScriptsNames(agentId, buildVersion): Promise<BundleScriptNames> {
    const data = await this.getFromDb('scriptnames', { agentId, buildVersion });
    return data[0]?.names;
  }

  public async cleanMainScriptNames() {
    await this.removeFromDb('scriptnames');
  }
  // #endregion

  // #region db interaction // TODO abstract db interaction
  private async connect() {
    const mongoClient = new MongoClient(`mongodb://${this.settings.host}`, { useUnifiedTopology: true });

    return new Promise((resolve, reject) => {
      mongoClient.connect((err, client): void => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const db = client.db(this.settings.dbname);
          resolve(db);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  private async saveToDb(collection, data): Promise<void> {
    const shallowCopy = { ...data }; // prevents mongodb from adding unwanted _id property to the original data object
    await new Promise((resolve, reject) => {
      this.db.collection(collection).insertOne(shallowCopy, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private async upsertToDb(collection, data, query): Promise<void> {
    await new Promise((resolve, reject) => {
      this.db.collection(collection).updateOne(query, { $set: data }, { upsert: true }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  public async findAll(collection, query = {}) {
    const data: any = await this.getFromDb(collection, query);
    return data;
  }

  public async save(collection, data) {
    return this.saveToDb(collection, data);
  }

  private async getFromDb(collection, query = {}): Promise<any> {
    const data: any[] = await new Promise((resolve, reject) => {
      this.db
        .collection(collection)
        .find(query, { _id: 0 })
        .toArray((err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
    });
    // TODO dirty hack because projection doesnt work for whatever reason
    // does not mean much, mongo will get scrapped anyway
    return data.map(x => {
      const { _id, ...document } = x;
      return document;
    });
  }

  private async removeFromDb(collection, query = {}): Promise<void> {
    await new Promise((resolve, reject) => {
      this.db.collection(collection).deleteMany(query, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
  // #endregion
}

const storage = new Storage(process.env.MONGO_HOST, process.env.MONGO_DBNAME);
export default storage;
