import * as bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';

import * as swaggerController from './controllers/swagger';
import { spec } from './controllers/swagger';

import * as astController from './controllers/ast';
import * as coverageController from './controllers/coverage';
import * as pluginController from './controllers/plugin';

import { loggerMiddleware } from './middleware/logger';

interface AppConfig {
  port: number,
  body?: {
    json?: { limit: string, }
    urlencoded?: { limit: string, }
  }
}

export class App {
  public app: express.Application;

  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.app = express();
    this.app.use(bodyParser.json({
      limit: this.config.body?.json?.limit || '50mb',
    }));
    this.app.use(bodyParser.urlencoded({
      limit: this.config.body?.urlencoded?.limit || '50mb',
      extended: true,
    }));
    this.app.use(cors());
    this.app.use(loggerMiddleware);
    this.setRoutes();
  }

  public async start(): Promise<Express.Application> {
    return new Promise((resolve, reject) => { // TODO reject
      this.app.listen(this.config.port, () => {
        console.log(`   App is running at http://localhost:${this.config.port} in ${this.app.get('env')} mode
        \n Press CTRL-C to stop \n`);
        resolve(this.app);
      });
    });
  }

  private setRoutes() {
    this.app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        explorer: true,
      }),
    );
    this.app.get('/api-docs', swaggerController.apiDocs);

    this.app.get('/', (req, res) => {
      res.json({ status: 200, message: 'JS middleware API. Use /api-docs to view routes description.' });
    });

    // TODO swagger docs
    this.app.post('/ast', astController.saveAst);

    this.app.post('/source-maps', coverageController.saveSourceMap);

    this.app.post('/coverage', coverageController.saveTestResults);

    this.app.post('/start-session', pluginController.startSession);
    this.app.post('/finish-session', pluginController.finishSession);
  }
}
