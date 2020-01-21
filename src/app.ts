import * as bodyParser from 'body-parser';
import express from 'express';
import { SERVER_PORT } from './constants';
import * as statusController from './controllers/status';

export class App {
  app: express.Application;

  constructor() {
    this.app = express();
    this.app.use(bodyParser.json());
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
    this.app.get('/', statusController.index);
  }
}
