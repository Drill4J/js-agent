import { agentService } from './agent.service';
import storage from '../storage';

export async function sendTestResults(data): Promise<void> {
  const sessionId = await storage.getSessionId();

  await agentService.sendToPlugin(process.env.TEST_2_CODE_PLUGINID, {
    type: 'COVERAGE_DATA_PART',
    sessionId,
    data,
  });
}
