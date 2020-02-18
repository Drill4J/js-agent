import { getAstDiff } from '../services/ast.service';
import {
  getBuildRisks,
  getCoverageForBuild,
  processCoverageData,
} from '../services/coverage.service';
import { getAstData, getCoverageData } from '../storage';
import { saveCoverageData } from '../storage';
import { mainScriptNames } from './source.maps';

export const getAffectedTests = (req, res) => {
  const branch = req.query.branch;

  const coverage = getCoverageForBuild(branch);
  const updated = getAstDiff(branch).updated;

  const methods = [];

  coverage.coverage.map(it => methods.push(...it.methods));

  const affectedMethods = methods.filter(it => updated.includes(it.method));

  const affectedTests = [];

  affectedMethods.forEach(it => affectedTests.push(...it.tests));

  res.json(affectedTests);
};

export const saveCoverage = async (req, res) => {
  const sources = req.body.scriptSources;
  const coverage = req.body.coverage.filter(it => it.url !== '');
  const test = req.body.test;
  const branch = req.body.branch;

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

  saveCoverageData({
    branch,
    test,
    coverage: result,
  });

  res.json({ status: `Coverage data saved. BuildId ${branch}` });
};

export const getCoverage = (req, res) => {
  const branch = req.query.branch;
  res.json(getCoverageForBuild(branch));
};

export const getRawCoverage = (req, res) => {
  const uuid = req.query.uuid;
  res.json(getCoverageData(uuid));
};

export const getRisks = (req, res) => {
  const branch = req.query.branch;
  res.json(getBuildRisks(branch));
};
