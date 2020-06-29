import { agentService } from './agent.service';
import storage from '../storage';

export async function sendCoverageToDrill(testName: string, coverage): Promise<void> {
  const sessionId = await storage.getSessionId();

  const formatted = coverage.map(({ file, methods = [] }) =>
    convertLineToProbeCoverage(testName, file, methods)).filter(({ probes }) => probes.length);

  await agentService.sendToPlugin(process.env.TEST_2_CODE_PLUGINID, {
    type: 'COVERAGE_DATA_PART',
    sessionId,
    data: formatted,
  });
}

function convertLineToProbeCoverage(testName, file, methods = []) {
  const probes = methods.reduce((fileProbes, method) => {
    const methodProbes = method.probes.reduce((acc, probe) => {
      acc.push(method.coveredLines.indexOf(probe) > -1);
      return acc;
    }, []);
    return [...fileProbes, ...methodProbes];
  }, []);

  return {
    id: 0,
    className: file,
    probes,
    testName,
  };
}
