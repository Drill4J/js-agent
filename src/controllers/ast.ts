import { getAstData, saveAstData } from '../storage';
import { AstData } from '../model/ast.data';

export const saveAst = (req, res) => {
  const data: AstData = req.body;
  saveAstData(data);
  res.json({ status: 'ast data saved' });
};

export const getAst = (req, res) => {
  res.json(getAstData());
};

export const tree = (req, res) => {
  const ast = getAstData();
  const data = [];
  ast.forEach(r => {
    const methods = [];
    r.data.methods.forEach(m => {
      methods.push({
        name: m.name,
        params: m.params,
      });
    });

    data.push({
      fileName: r.filePath,
      methods: methods,
    });
  });

  res.json(data);
};
