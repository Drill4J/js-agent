import { Request, Response } from 'express';
/* eslint-disable import/no-unresolved */ // TODO configure local-module-first resolution (for development purposes)
import {
  // Messages
  SessionStarted,
  SessionFinished,
} from '@drill4j/test2code-types';
import { agentService } from '../services/agent.service';
import storage from '../storage';

export async function startSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.body;
  await storage.saveSessionId(sessionId);

  const sessionStartedMessage: SessionStarted = {
    type: 'SESSION_STARTED',
    sessionId,
    testType: 'MANUAL', // TODO send actuall test type, dont just send 'MANUAL'
    ts: 0,
  };

  agentService.sendToPlugin(process.env.TEST_2_CODE_PLUGINID, sessionStartedMessage);
  res.json({ status: 200, data: { sessionId } });
}

export async function finishSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.body;
  await storage.cleanSession(sessionId); // TODO we might want to implement sessionService in case if we need to keep old sessions

  const sessionFinishedMessage: SessionFinished = {
    type: 'SESSION_FINISHED',
    sessionId,
    ts: 0,
  };
  agentService.sendToPlugin(process.env.TEST_2_CODE_PLUGINID, sessionFinishedMessage);

  res.json({ status: 200, data: { sessionId } });
}
