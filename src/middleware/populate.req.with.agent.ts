import { AgentHub } from '../services/agent.hub';

export default async function (req, res, next: any): Promise<void> {
  const agentId = String(req.query.agentId);

  const agentHub = (this.agentHub as AgentHub);

  const agentExists = await agentHub.doesAgentExist(agentId);
  if (!agentExists) {
    throw new Error(`Agent with id ${agentId} does not exist`);
  }

  if (!req.drillCtx) {
    req.drillCtx = {};
  }
  req.drillCtx.agent = agentHub.getAgentById(agentId);
  next();
}
