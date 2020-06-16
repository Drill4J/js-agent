import { Request, Response } from 'express';

import { agentSocket } from '../services/agent.service';
import { toPluginMessage } from '../services/plugin.service';
import { saveSessionId } from '../storage';

export function startSession({ body: { sessionId = '' } = {} }: Request, res: Response): void {
  saveSessionId(sessionId);
  agentSocket.connection.send(toPluginMessage('test2code', JSON.stringify({
    type: 'SESSION_STARTED',
    sessionId,
    testType: 'MANUAL',
    ts: 0,
  })));

  res.json({ status: 200, message: 'Session started' });
}

export function finishSession({ body: { sessionId = '' } = {} }: Request, res: Response): void {
  agentSocket.connection.send(toPluginMessage('test2code', JSON.stringify({
    type: 'SESSION_FINISHED',
    sessionId,
    ts: 0,
  })));

  res.json({ status: 200, message: 'Session finished' });
}
