import { getAstDiff } from '../services/ast.service';
import {
  getBuildRisks,
  getCoverageForBuild,
  processCoverageData,
  getCoverageData,
} from '../services/coverage.service';
import { sendCoverageToDrill } from '../services/plugin.service';
import storage from '../storage';

export const getAffectedTests = async (req, res): Promise<any> => {
  const { branch } = req.query;

  const coverage = await getCoverageForBuild(branch);
  const { updated } = await getAstDiff(branch);

  const methods = [];

  coverage.coverage.map(it => methods.push(...it.methods));

  const affectedMethods = methods.filter(it => updated.includes(it.method));

  const affectedTests = [];

  affectedMethods.forEach(it => affectedTests.push(...it.tests));

  res.json(affectedTests);
};

export const saveCoverage = async (req, res): Promise<any> => {
  const {
    body: {
      coverage: requestCoverage = [], test, branch = 'master', scriptSources: sources,
    },
  } = req;
  const coverage = requestCoverage.filter(({ url }) => url !== '');
  const coverageData = await processCoverageData(sources, coverage);

  await storage.saveCoverage({
    branch,
    test,
    data: coverageData,
  });

  await sendCoverageToDrill(test.name);

  setTimeout(() => res.json({ status: `Coverage data saved. BuildId ${branch}` }), 2000);
};

export const getCoverage = async (req, res): Promise<any> => {
  const { branch } = req.query;
  const data = await getCoverageForBuild(branch);
  res.json(data);
};

export const getRawCoverage = async (req, res): Promise<any> => {
  const { uuid } = req.query;
  const data = await getCoverageData(uuid);
  res.json(data);
};

export const getRisks = async (req, res): Promise<any> => {
  const { branch } = req.query;
  const data = await getBuildRisks(branch);
  res.json(data);
};
