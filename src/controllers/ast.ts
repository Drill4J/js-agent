import { getAstData, saveAstData } from '../storage';
import { AstData } from '../model/ast.data';
import { getAstDiff, getAstTree } from '../services/ast.service';

export const saveAst = (req, res) => {
  const data: AstData = req.body;
  saveAstData(data);
  res.json({ status: 'ast data saved' });
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
