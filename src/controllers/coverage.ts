import * as coverageService from '../services/coverage.service';

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
