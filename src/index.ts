import { App } from './app';

import * as bodyParser from 'body-parser';
import { AstController } from './controllers/ast.controller';
import { CoverageController } from './controllers/coverage.controller';
import { SourceMapsController } from './controllers/source.maps.controller';
import { StatusControler } from './controllers/status.controller';
import { loggerMiddleware } from './middleware/logger';

const PORT = parseInt(process.env.PORT) || 8080;

export const app = new App({
  port: PORT,
  controllers: [
    new StatusControler(),
    new SourceMapsController(),
    new AstController(),
    new CoverageController(),
  ],
  middleWares: [
    bodyParser.json({ limit: '50mb' }),
    bodyParser.urlencoded({ limit: '50mb', extended: true }),
    // loggerMiddleware
  ],
});

export const server = app.listen();
