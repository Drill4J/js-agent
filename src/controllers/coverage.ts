import { getCoverageData, getAstData } from '../storage';
import { saveCoverageData } from '../storage';
import { mainScriptNames } from './source.maps';
import {
  getCoverageForBuild,
  processCoverageData,
} from '../services/coverage.service';
import { getAstDiff } from '../services/ast.service';

export const getAffectedTests = (req, res) => {
  const uuid = req.query.uuid;

  const coverage = getCoverageForBuild(uuid);
  const updated = getAstDiff().updated;

  const methods = [];

  coverage.map(it => methods.push(...it.methods));

  const affectedMethods = methods.filter(it => updated.includes(it.method));

  const affectedTests = [];

  affectedMethods.forEach(it => affectedTests.push(...it.tests));

  res.json(affectedTests);
};

export const saveCoverage = async (req, res) => {
  const sources = req.body.scriptSources;
  const coverage = req.body.coverage.filter(it => it.url !== '');
  const testName = req.body.testName;
  const runUuid = getAstData().buildId;

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
    runUuid,
    testName,
    coverage: result,
  });

  res.json({ status: `Coverage data saved. BuildId ${runUuid}` });
};

export const getCoverage = (req, res) => {
  const uuid = req.query.uuid;
  res.json(getCoverageForBuild(uuid));
};

export const getRawCoverage = (req, res) => {
  res.json(getCoverageData());
};
