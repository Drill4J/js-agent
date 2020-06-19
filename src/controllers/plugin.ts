import { Request, Response } from 'express';
import { agentSocket } from '../services/agent.service';
import { toPluginMessage } from '../services/plugin.service';
import storage from '../storage';

export async function startSession({ body: { sessionId = '' } = {} }: Request, res: Response): Promise<void> {
  await storage.saveSessionId(sessionId);

  agentSocket.connection.send(toPluginMessage('test2code', JSON.stringify({ // TODO implement send and sendToTest2Code async wrappers
    type: 'SESSION_STARTED',
    sessionId,
    testType: 'MANUAL',
    ts: 0,
  })));

  res.json({ status: 200, message: 'Session started' });
}

export async function finishSession({ body: { sessionId = '' } = {} }: Request, res: Response): Promise<void> {
  await storage.cleanSession(sessionId); // TODO we might want to implement sessionService in case if we need to keep old sessions

  agentSocket.connection.send(toPluginMessage('test2code', JSON.stringify({
    type: 'SESSION_FINISHED',
    sessionId,
    ts: 0,
  })));

  res.json({ status: 200, message: 'Session finished' });
}
