/* eslint-disable import/no-unresolved */ // TODO configure local-module-first resolution (for development purposes)
import {
  // Messages
  CoverDataPart,
} from '@drill4j/test2code-types';
import { agentService } from './agent.service';
import storage from '../storage';

export async function sendTestResults(data): Promise<void> {
  const sessionId = await storage.getSessionId();

  const coverDataPartMessage: CoverDataPart = {
    type: 'COVERAGE_DATA_PART',
    sessionId,
    data,
  };
  await agentService.sendToPlugin(process.env.TEST_2_CODE_PLUGINID, coverDataPartMessage);
}
