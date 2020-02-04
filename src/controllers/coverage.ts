import { getCoverageData } from '../storage';
import { saveCoverageData } from '../storage';
import { mainScriptNames } from './source.maps';
import {
  getCoverageForBuild,
  processCoverageData,
} from '../services/coverage.service';

export const saveCoverage = async (req, res) => {
  const sources = req.body.scriptSources;
  const coverage = req.body.coverage;
  const testName = req.body.testName;
  const runUuid = req.body.runUuid;

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

    res.json(resp);
  }

  saveCoverageData({
    runUuid,
    testName,
    coverage: result,
  });

  res.json({ status: 'coverage data saved' });
};

export const getCoverage = (req, res) => {
  const uuid = req.query.uuid;
  res.json(getCoverageForBuild(uuid));
};

export const getRawCoverage = (req, res) => {
  res.json(getCoverageData());
};
