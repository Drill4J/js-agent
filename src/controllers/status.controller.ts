import * as express from 'express';
import { Request, Response } from 'express';
import { BaseController } from './base.controller';

export class StatusControler extends BaseController {
  public initRoutes() {
    this.router.get('/', (req: Request, res: Response) => {
      res.json({ status: 'Listening...' });
    });
  }
}
