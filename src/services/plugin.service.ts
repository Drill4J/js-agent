// eslint-disable-next-line import/no-cycle
import { agentSocket } from './agent.service';
import { getCoverageForBuild } from './coverage.service';
import storage from '../storage';

export async function sendCoverageToDrill(testName: string): Promise<void> {
  const { coverage = [] } = await getCoverageForBuild('master');
  const sessionId = await storage.getSessionId();

  const formatted = coverage.map(({ file, methods = [] }) =>
    convertLineToProbeCoverage(testName, file, methods)).filter(({ probes }) => probes.length);

  await agentSocket.connection.send(toPluginMessage('test2code', JSON.stringify({
    type: 'COVERAGE_DATA_PART',
    sessionId,
    data: formatted,
  })));
}

function convertLineToProbeCoverage(testName, file, methods = []) {
  const p = methods.reduce((acc, { probes, coveredLines }) => [...acc, ...probes.map(probe => coveredLines.includes(probe))], []);
  return {
    id: 0,
    className: file.slice(1, file.length),
    probes: p,
    testName,
  };
}

export function toPluginMessage(pluginId: string, msg: string): string {
  return JSON.stringify({
    type: 'PLUGIN_DATA',
    text: JSON.stringify({
      pluginId,
      drillMessage: { content: msg },
    }),
  });
}
