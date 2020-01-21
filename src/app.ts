import * as bodyParser from 'body-parser';
import express from 'express';

import * as statusController from './controllers/status';

export const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.get('/', statusController.index);
