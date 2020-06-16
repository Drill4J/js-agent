import { v4 as uuid } from 'uuid';
import { getAstDiff, getAstTree } from '../services/ast.service';
import { agentSocket } from '../services/agent.service';
import { getAstData, saveAstData } from '../storage';
import { AstData } from '../types/ast-data';


export const saveAst = ({ body }, res) => {
  const request: AstData = body;

  const buildId = uuid();

  const result = {
    buildId,
    branch: request.branch,
    data: request.data,
  };

  saveAstData(result);
  agentSocket.init();


  res.json({ status: 'Ast data saved', buildId });
};

export const getAst = ({ query: { branch } }, res) => {
  res.json(getAstData(branch));
};

export const tree = ({ query: { branch } }, res) => {
  res.json(getAstTree(branch));
};

export const astDiff = ({ query: { branch } }, res) => {
  res.json(getAstDiff(branch));
};
