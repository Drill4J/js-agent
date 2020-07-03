import * as bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';

import * as swaggerController from './controllers/swagger';
import { spec } from './controllers/swagger';

import loggerMiddleware from './middleware/logger';
import populateReqWithAgent from './middleware/populate.req.with.agent';
import ensureAgentRegistration from './middleware/ensure.agent.registration';
import responseHandler from './middleware/response.handler';

import { AgentHub, Agent } from './services/agent.hub';

interface AppConfig {
  port: number,
  body?: {
    json?: { limit: string, }
    urlencoded?: { limit: string, }
  }
}

declare module 'express-serve-static-core' {
  export interface Request {
    drillCtx?: {
      agent?: Agent // TODO agent should not be optional
    }
  }
}

export class App {
  public app: express.Application;

  private config: AppConfig;

  private agentHub: AgentHub;

  private middleware: any;

  constructor(config: AppConfig, agentHub: AgentHub) {
    this.middleware = {
      ensureAgentRegistration: ensureAgentRegistration.bind(this),
      populateReqWithAgent: populateReqWithAgent.bind(this),
    };

    this.agentHub = agentHub;
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

    this.app.use(responseHandler);

    this.app.post('/ast',
      this.middleware.ensureAgentRegistration,
      this.middleware.populateReqWithAgent,
      (req) => {
        req.drillCtx.agent.updateAst(req.body.data);
      });

    this.app.use(this.middleware.populateReqWithAgent);

    this.app.post('/source-maps', (req) => req.drillCtx.agent.updateSourceMaps(req.body.data));
    // this.app.post('/coverage', (req) => req.drillCtx.agent.saveTestResults(req.body.data));
    // this.app.post('/start-session', (req) => req.drillCtx.agent.startSession(req.body.data));
    // this.app.post('/finish-session', (req) => req.drillCtx.agent.finishSession(req.body.data));

    // this.app.post('/ast', astController.saveAst);

    // this.app.post('/source-maps', coverageController.saveSourceMap);

    // this.app.post('/coverage', coverageController.saveTestResults);

    // this.app.post('/start-session', pluginController.startSession);
    // this.app.post('/finish-session', pluginController.finishSession);
  }
}
