import { getAstData, saveAstData } from '../storage';
import { BaseController } from './base.controller';

// export class AstController extends BaseController {
//   public initRoutes() {
//     // this.router.post('/ast', (req, res) => {
//     //   const data = req.body;
//     //   saveAstData(data);
//     //   res.json({ status: 'ast data saved' });
//     // });

//     /**
//      * @swagger
//      *
//      * /ast:
//      *   get:
//      *     description: Return ast data
//      *     produces:
//      *       - application/json
//      *     responses:
//      *       200:
//      *         description: ast data
//      */
//     this.router.get('/ast', (req, res) => {
//       res.json(getAstData());
//     });
//   }
// }

export const saveAst = (req, res) => {
  const data = req.body;
  saveAstData(data);
  res.json({ status: 'ast data saved' });
};

export const getAst = (req, res) => {
  res.json(getAstData());
};
