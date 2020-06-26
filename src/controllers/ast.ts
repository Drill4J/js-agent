import { v4 as uuid } from 'uuid';
import sizeof from 'sizeof';
import * as astService from '../services/ast.service';
import { agentSocket } from '../services/agent.service';
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

  // TODO omits excessive properties. It's ugly but required. Move it elsewhere, perhaps
  const formattedAst = ast.data.map(file => ({
    path: file.path,
    name: file.name,
    methods: file.methods.map(x => ({
      name: x.name,
      params: x.params,
      returnType: x.returnType,
      probes: x.probes,
      count: x.count,
    })),
  }));
  agentSocket.init(formattedAst);

  res.json({ status: 'Ast data saved', buildId });
};

export const getAst = async ({ query: { branch } }, res): Promise<any> => {
  const data = await astService.getAst(branch);
  res.json(data);
};

export const tree = async ({ query: { branch } }, res): Promise<any> => {
  const data = await astService.getAst(branch);
  res.json(data);
};

export const astDiff = async ({ query: { branch } }, res): Promise<any> => {
  const data = await astService.getAstDiff(branch);
  res.json(data);
};
