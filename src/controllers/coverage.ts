import * as coverageService from '../services/coverage.service';
import * as pluginService from '../services/plugin.service';

export const saveTestResults = async (req, res): Promise<any> => {
  const {
    body: {
      coverage, test, branch = 'master', scriptSources: sources,
    },
  } = req;

  const data = await coverageService.processTestResults(test, branch, sources, coverage);
  await pluginService.sendTestResults(data);

  res.json({ status: 200 });
};

export async function saveSourceMap(req, res): Promise<any> {
  const data = req.body;
  await coverageService.saveSourceMap(data);
  res.json({ status: 200 });
}
