import * as bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';

import * as swaggerController from './controllers/swagger';
import { spec } from './controllers/swagger';

import loggerMiddleware from './middleware/logger';
import populateReqWithAgent from './middleware/populate.req.with.agent';
import populateReqWithTest2Code from './middleware/populate.req.with.test2code';
import ensureAgentRegistration from './middleware/ensure.agent.registration';
import responseHandler from './middleware/response.handler';

import { AgentHub, Agent, Plugin } from './services/agent.hub';

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
      agent?: Agent // TODO agent should not be optional,
      plugin?: Plugin
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
      populateReqWithTest2Code,
      (req) => {
        const { plugin } = req.drillCtx;
        if (plugin.isTest2CodePlugin()) {
          plugin.updateAst(req.body.data);
        }
      });

    this.app.use(this.middleware.populateReqWithAgent);
    this.app.use(populateReqWithTest2Code);

    this.app.post('/source-maps', (req) => {
      const { plugin } = req.drillCtx;
      if (plugin.isTest2CodePlugin()) {
        plugin.updateSourceMaps(req.body);
      }
    });

    this.app.post('/start-session', (req) => {
      const { plugin } = req.drillCtx;
      if (plugin.isTest2CodePlugin()) {
        const { sessionId } = req.body;
        plugin.startSession(sessionId);
      }
    });

    this.app.post('/coverage', (req) => {
      const { plugin } = req.drillCtx;
      if (plugin.isTest2CodePlugin()) {
        // const { sessionId, data } = req.body;
        plugin.processCoverage(req.body);
      }
    });

    this.app.post('/finish-session', (req) => {
      const { plugin } = req.drillCtx;
      if (plugin.isTest2CodePlugin()) {
        const { sessionId } = req.body;
        plugin.finishSession(sessionId);
      }
    });
  }
}
