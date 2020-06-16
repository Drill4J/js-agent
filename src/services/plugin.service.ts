// eslint-disable-next-line import/no-cycle
import { agentSocket } from './agent.service';
import { getCoverageForBuild } from './coverage.service';
import { getSessionId } from '../storage';

export async function sendCoverageToDrill(testName: string): Promise<void> {
  const { coverage = [] } = getCoverageForBuild('master');
  const sessionId = getSessionId();

  const formatted = coverage.map(({ file, methods = [] }) => ({
    id: 0,
    className: file.slice(1, file.length),
    probes: methods.reduce((acc, { probes, coveredLines }) => [...acc, ...probes.map(probe => coveredLines.includes(probe))], []),
    testName,
  })).filter(({ probes }) => probes.length);

  await agentSocket.connection.send(toPluginMessage('test2code', JSON.stringify({
    type: 'COVERAGE_DATA_PART',
    sessionId,
    data: formatted,
  })));
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
