import { ExtendableContext, Next } from 'koa';
import { IRouterParamContext } from 'koa-router';

export default async function (ctx: ExtendableContext & IRouterParamContext, next: Next): Promise<void> {
  const { agent } = ctx.state.drill;
  if (!agent) {
    throw new Error('agent instance not found!');
  }

  const plugin = agent.ensurePluginInstance(ctx.params.pluginId);
  if (plugin.isTest2CodePlugin()) {
    ctx.state.drill.test2Code = plugin;
  }
  return next();
}
