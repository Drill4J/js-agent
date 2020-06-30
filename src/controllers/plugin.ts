import { Request, Response } from 'express';
import { agentService } from '../services/agent.service';
import storage from '../storage';

export async function startSession({ body: { sessionId = '' } = {} }: Request, res: Response): Promise<void> {
  await storage.saveSessionId(sessionId);

  agentService.sendToPlugin(process.env.TEST_2_CODE_PLUGINID, {
    type: 'SESSION_STARTED',
    sessionId,
    testType: 'MANUAL', // TODO send actuall test type, dont just send 'MANUAL'
    ts: 0,
  });

  res.json({ status: 200 });
}

export async function finishSession({ body: { sessionId = '' } = {} }: Request, res: Response): Promise<void> {
  await storage.cleanSession(sessionId); // TODO we might want to implement sessionService in case if we need to keep old sessions

  agentService.sendToPlugin(process.env.TEST_2_CODE_PLUGINID, {
    type: 'SESSION_FINISHED',
    sessionId,
    ts: 0,
  });

  res.json({ status: 200 });
}
