import { BaseController } from './base.controller';

export let astData: any = {};

export class AstController extends BaseController {
  public initRoutes() {
    this.router.post('/ast', (req, res) => {
      const ast = req.body;
      astData = ast;
      res.json({ status: 'ast data saved' });
    });

    this.router.get('/ast', (req, res) => {
      res.json(astData);
    });
  }
}
