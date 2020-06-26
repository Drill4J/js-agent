import * as bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import * as astController from './controllers/ast';
import * as coverageController from './controllers/coverage';
import * as sourceMapsController from './controllers/source.maps';
import * as statusController from './controllers/status';
import * as swaggerController from './controllers/swagger';
import { spec } from './controllers/swagger';
import * as pluginController from './controllers/plugin';
import { loggerMiddleware } from './middleware/logger';

interface AppConfig {
  port: number
}

export class App {
  public app: express.Application;

  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.app = express();
    this.app.use(bodyParser.json({ limit: '50mb' }));
    this.app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    this.app.use(cors());
    this.app.use(loggerMiddleware);
    this.setRoutes();
  }

  public async start(): Promise<Express.Application> {
    return new Promise((resolve, reject) => { // TODO reject
      this.app.listen(this.config.port, () => {
        console.log(
          '  App is running at http://localhost:%d in %s mode',
          this.config.port,
          this.app.get('env'),
        );
        console.log('  Press CTRL-C to stop\n');
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

    this.app.get('/', statusController.index);
    /**
     * @swagger
     *
     * /ast:
     *   get:
     *     description: Return ast data
     *     produces:
     *       - application/json
     *     responses:
     *       200:
     *         description: ast data
     */
    this.app.get('/ast', astController.getAst);
    this.app.post('/ast', astController.saveAst);
    this.app.get('/tree', astController.tree);
    this.app.get('/ast/diff', astController.astDiff);

    this.app.get('/source-maps', sourceMapsController.getSourceMap);
    this.app.post('/source-maps', sourceMapsController.saveSourceMap);

    /**
     * @swagger
     *
     * /coverage:
     *   get:
     *     description: Return coverage data
     *     produces:
     *       - application/json
     *     responses:
     *       200:
     *         description: coverage data
     */
    this.app.get('/coverage', coverageController.getCoverage);
    this.app.get('/coverage/rawData', coverageController.getScopeTests);
    this.app.post('/coverage', coverageController.saveTestResults);
    /**
     * @swagger
     *
     * /affectedTests?uuid={uuid}:
     *   get:
     *     description: Return affected tests
     *     produces:
     *       - application/json
     *     parameters:
     *      - in: query
     *        name: uuid
     *        schema:
     *          type: string
     *        required: true
     *        description: Id of the user
     *     responses:
     *       200:
     *         description: affected tests array
     */
    this.app.get('/affectedTests', coverageController.getAffectedTests);

    this.app.get('/risks', coverageController.getRisks);

    this.app.post('/start-session', pluginController.startSession);

    this.app.post('/finish-session', pluginController.finishSession);
  }
}
