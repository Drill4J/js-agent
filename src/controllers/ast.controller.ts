import { getAstData, saveAstData } from '../storage';
import { BaseController } from './base.controller';

export class AstController extends BaseController {
  public initRoutes() {
    this.router.post('/ast', (req, res) => {
      const data = req.body;
      saveAstData(data);
      res.json({ status: 'ast data saved' });
    });

    this.router.get('/ast', (req, res) => {
      res.json(getAstData());
    });
  }
}
