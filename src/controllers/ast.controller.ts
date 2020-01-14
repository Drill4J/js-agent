import { BaseController } from './base.controller';

let astData = {};

export class AstController extends BaseController {
  public initRoutes() {
    this.router.post('/ast', (req, res) => {
      const ast = req.body;
      astData = ast;
      res.json({ status: 'ast data saved' });
    });
  }
}
