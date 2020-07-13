import { Next, ExtendableContext } from 'koa';
import { IRouterParamContext } from 'koa-router';
import { AgentHub } from '../services/agent.hub';

export default async function (ctx: ExtendableContext & IRouterParamContext, next: Next): Promise<void> {
  const agentId = String(ctx.params.agentId);

  const agentHub = (this.agentHub as AgentHub);

  const agentExists = await agentHub.doesAgentExist(agentId); // TODO might move that to getAgentInstance method with a check inside
  if (!agentExists) {
    throw new Error(`Agent with id ${agentId} does not exist`);
  }

  ctx.state.drill = {
    agent: agentHub.getAgentById(agentId),
  };
  return next();
}
