import * as bodyParser from 'body-parser';
import express from 'express';

import swaggerUi from 'swagger-ui-express';
import { SERVER_PORT } from './constants';
import * as astController from './controllers/ast';
import * as coverageController from './controllers/coverage';
import * as sourceMapsController from './controllers/source.maps';
import * as statusController from './controllers/status';
import * as swaggerController from './controllers/swagger';
import { spec } from './controllers/swagger';

export class App {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.app.use(bodyParser.json({ limit: '50mb' }));
    this.app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    this.setRoutes();
  }

  public start(port: number = SERVER_PORT) {
    return this.app.listen(port, () => {
      console.log(
        '  App is running at http://localhost:%d in %s mode',
        port,
        this.app.get('env')
      );
      console.log('  Press CTRL-C to stop\n');
    });
  }

  private setRoutes() {
    this.app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        explorer: true,
      })
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

    this.app.get('/source-maps', sourceMapsController.getSourceMap);
    this.app.post('/source-maps', sourceMapsController.saveSourceMap);

    this.app.get('/coverage', coverageController.getCoverage);
    this.app.get('/coverage/rawData', coverageController.getRawCoverage);
    this.app.post('/coverage', coverageController.saveCoverage);
  }
}
