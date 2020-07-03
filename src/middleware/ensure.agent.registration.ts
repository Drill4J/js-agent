import { AgentHub, AgentData } from '../services/agent.hub';

export default async function (req, res, next: any): Promise<void> {
  const agentId = String(req.query.agentId);

  const agentHub = (this.agentHub as AgentHub);

  const agentExists = await agentHub.doesAgentExist(agentId);
  if (!agentExists) {
    const agentData: AgentData = {
      id: agentId,
      instanceId: process.env.AGENT_INSTANCE_ID || '', // TODO what is that for and how it should be configured
      buildVersion: process.env.AGENT_BUILD_VERSION || '0.1.0', // TODO what is that for and how it should be configured
      serviceGroupId: process.env.AGENT_SERVICE_GROUP_ID || '', // TODO what is that for and how it should be configured
      agentType: 'NODEJS',
    };
    await agentHub.registerAgent(agentData);
  }
  next();
}
