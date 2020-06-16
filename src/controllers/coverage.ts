import { getAstDiff } from '../services/ast.service';
import {
  getBuildRisks,
  getCoverageForBuild,
  processCoverageData,
} from '../services/coverage.service';
import { getCoverageData, saveCoverageData } from '../storage';
import { sendCoverageToDrill } from '../services/plugin.service';

import { mainScriptNames } from './source.maps';

export const getAffectedTests = (req, res) => {
  const { branch } = req.query;

  const coverage = getCoverageForBuild(branch);
  const { updated } = getAstDiff(branch);

  const methods = [];

  coverage.coverage.map(it => methods.push(...it.methods));

  const affectedMethods = methods.filter(it => updated.includes(it.method));

  const affectedTests = [];

  affectedMethods.forEach(it => affectedTests.push(...it.tests));

  res.json(affectedTests);
};

export const saveCoverage = async (req, res) => {
  const {
    body: {
      coverage: requestCoverage = [], test, branch = 'master', scriptSources: sources,
    },
  } = req;
  const coverage = requestCoverage.filter(({ url }) => url !== '');

  if (mainScriptNames.length === 0) {
    const resp = {
      status: 'Error during coverage processing. Add source maps at first',
    };

    res.status(500).json(resp);
  }

  const result = await processCoverageData(sources, coverage);

  if (!result) {
    const resp = {
      status: 'Error during coverage processing',
      mainScriptNames,
    };

    res.status(500).json(resp);
  }

  await saveCoverageData({
    branch,
    test,
    coverage: result,
  });

  await sendCoverageToDrill('test');

  setTimeout(() => res.json({ status: `Coverage data saved. BuildId ${branch}` }), 2000);
};

export const getCoverage = (req, res) => {
  const { branch } = req.query;
  res.json(getCoverageForBuild(branch));
};

export const getRawCoverage = (req, res) => {
  const { uuid } = req.query;
  res.json(getCoverageData(uuid));
};

export const getRisks = (req, res) => {
  const { branch } = req.query;
  res.json(getBuildRisks(branch));
};
