import { getAstData, saveAstData } from '../storage';

export const saveAst = (req, res) => {
  const data = req.body;
  saveAstData(data);
  res.json({ status: 'ast data saved' });
};

export const getAst = (req, res) => {
  res.json(getAstData());
};
