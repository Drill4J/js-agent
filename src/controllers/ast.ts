import { getAstData, saveAstData } from '../storage';
import { AstData } from '../model/ast.data';
import { getAstDiff, getAstTree } from '../services/ast.service';

import { v4 as uuid } from 'uuid';

export const saveAst = (req, res) => {
  const data: AstData = req.body;

  const buildId = uuid();

  const result = {
    buildId: buildId,
    data: data,
  };

  saveAstData(result);

  res.json({ status: `Ast data saved. BuildId ${buildId}` });
};

export const getAst = (req, res) => {
  const index = req.query.index;
  res.json(getAstData(index));
};

export const tree = (req, res) => {
  res.json(getAstTree());
};

export const astDiff = (req, res) => {
  res.json(getAstDiff());
};
