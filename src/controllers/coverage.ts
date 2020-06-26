import { getAstDiff } from '../services/ast.service';
import * as coverageService from '../services/coverage.service';

export const getAffectedTests = async (req, res): Promise<any> => {
  const { branch } = req.query;

  const coverage = await coverageService.getCoverageForBuild(branch);
  const { updated } = await getAstDiff(branch);

  const methods = [];

  coverage.coverage.map(it => methods.push(...it.methods));

  const affectedMethods = methods.filter(it => updated.includes(it.method));

  const affectedTests = [];

  affectedMethods.forEach(it => affectedTests.push(...it.tests));

  res.json(affectedTests);
};

export const saveTestResults = async (req, res): Promise<any> => {
  const {
    body: {
      coverage: requestCoverage = [], test, branch = 'master', scriptSources: sources,
    },
  } = req;
  const coverage = requestCoverage.filter(({ url }) => url !== '');

  await coverageService.processTestResults(test, branch, sources, coverage);

  setTimeout(() => res.json({ status: `Coverage data saved. BuildId ${branch}` }), 2000);
};

export const getCoverage = async (req, res): Promise<any> => {
  const { branch } = req.query;
  const data = await coverageService.getCoverageForBuild(branch);
  res.json(data);
};

export const getScopeTests = async (req, res): Promise<any> => {
  const { uuid } = req.query;
  const data = await coverageService.getScopeTests(uuid);
  res.json(data);
};

export const getRisks = async (req, res): Promise<any> => {
  const { branch } = req.query;
  const data = await coverageService.getBuildRisks(branch);
  res.json(data);
};
