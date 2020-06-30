import { v4 as uuid } from 'uuid';
import sizeof from 'sizeof';
import upath from 'upath';
import * as astService from '../services/ast.service';
import { agentService } from '../services/agent.service';
import { AstData } from '../types/ast-data';

export const saveAst = async ({ body }, res): Promise<any> => {
  const request: AstData = body;

  const buildId = uuid();

  console.log('AstController: saveAst: ast tree size:', sizeof.sizeof(request.data, true));

  const ast = {
    buildId,
    branch: request.branch,
    data: astService.formatAst(request.data),
  };

  await astService.saveAst(ast);

  // TODO converts from
  const formattedAst = ast.data.map(file => {
    const path = upath.dirname(file.filePath);
    const name = upath.basename(file.filePath);
    return {
      path: path.substring(1, path.length),
      name,
      methods: file.methods.map(x => ({
        name: x.name,
        params: x.params,
        returnType: x.returnType,
        probes: x.probes,
        count: x.count,
      })),
    };
  });
  agentService.init(formattedAst);

  res.json({ status: 200, data: { buildId } });
};
