import * as express from 'express';
import { Request, Response } from 'express';
import { BaseController } from './base.controller';

export class StatusControler extends BaseController {
  public initRoutes() {
    /**
     * @swagger
     *
     * /:
     *   get:
     *     description: Login to the application
     *     produces:
     *       - application/json
     *     responses:
     *       200:
     *         description: login
     */
    this.router.get('/', (req: Request, res: Response) => {
      res.json({ status: 'Listening...' });
    });
  }
}
