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
  public async saveAst(data) {
    await this.upsertToDb('ast', data, { branch: data.branch });
  }

  public async getAst(branch): Promise<any> {
    const asts = await this.getFromDb('ast', { branch });
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

  public async getCoverage(branch): Promise<any[]> {
    const coverages = await this.getFromDb('coverage', { branch });
    return coverages;
  }

  public async cleanCoverageData() {
    await this.removeFromDb('coverage');
  }

  // #endregion

  // #region sessionId
  public async saveSessionId(sessionId: string) {
    await this.saveToDb('session', { sessionId });
  }

  public async getSessionId(): Promise<string | undefined> {
    const sessions = await this.getFromDb('session');

    // TODO fix: might return wrong session in case there are > 1 session stored
    return sessions && sessions[0] && sessions[0].sessionId;
  }

  public async cleanSession(sessionId: string) {
    await this.removeFromDb('session', { sessionId });
  }
  // #endregion

  // #region sourcemaps (mainScriptNames)
  public async addMainScriptName(name) {
    await this.saveToDb('scriptnames', { name });
  }

  public async getMainScriptNames(): Promise<string[]> {
    const data = await this.getFromDb('scriptnames');
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
    await new Promise((resolve, reject) => {
      this.db.collection(collection).insertOne(data, (err, result) => {
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

  private async getFromDb(collection, query = {}): Promise<any> {
    const data = await new Promise((resolve, reject) => {
      this.db.collection(collection).find(query).toArray((err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
    return data;
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
