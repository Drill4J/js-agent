import { getAstData, saveAstData } from '../storage';

export const saveAst = (req, res) => {
  const data = req.body;
  saveAstData(data);
  res.json({ status: 'ast data saved' });
};

export const getAst = (req, res) => {
  res.json(getAstData());
};

export const tree = (req, res) => {
  const ast = getAstData();
  const data = [];
  ast.results.forEach(r => {
    const methods = [];
    r.result.methods.forEach(m => {
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
