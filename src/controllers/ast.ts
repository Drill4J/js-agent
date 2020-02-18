import { AstData } from '../model/ast.data';
import { getAstDiff, getAstTree } from '../services/ast.service';
import { getAstData, saveAstData } from '../storage';

import { v4 as uuid } from 'uuid';

export const saveAst = (req, res) => {
  const request: AstData = req.body;

  const buildId = uuid();

  const result = {
    buildId,
    branch: request.branch,
    data: request.data,
  };

  saveAstData(result);

  res.json({ status: `Ast data saved`, buildId });
};

export const getAst = (req, res) => {
  const branch = req.query.branch;
  res.json(getAstData(branch));
};

export const tree = (req, res) => {
  const branch = req.query.branch;
  res.json(getAstTree(branch));
};

export const astDiff = (req, res) => {
  const branch = req.query.branch;
  res.json(getAstDiff(branch));
};
