import { MongoClient } from 'mongodb';

export interface StorageSettings {
  host: string,
  dbname: string,
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

  // #region AST
  public async saveAst(agentId, data) {
    await this.upsertToDb('ast', { agentId, data }, { agentId });
  }

  public async getAst(agentId): Promise<any> {
    const asts = await this.getFromDb('ast', { agentId });
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
  public async saveSession(agentId: string, id: string) {
    await this.saveToDb('session', { agentId, id }); // TODO type session
  }

  public async getSession(agentId: string, id: string): Promise<any | undefined> {
    const sessions = await this.getFromDb('session', { agentId, id });

    // TODO fix: might return wrong session in case there are > 1 session stored
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
  public async addMainScriptName(agentId, name) {
    await this.saveToDb('scriptnames', { agentId, name });
  }

  public async getMainScriptNames(agentId): Promise<string[]> {
    const data = await this.getFromDb('scriptnames', { agentId });
    return data.map(x => x.name);
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
      this.db.collection(collection).find(query, { _id: 0 }).toArray((err, result) => {
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
