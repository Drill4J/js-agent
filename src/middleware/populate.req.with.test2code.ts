export default async function (req, res, next: any): Promise<void> {
  const { agent } = req.drillCtx;
  if (!agent) {
    throw new Error('drillCtx - agent instance not found!');
  }
  const plugin = agent.ensurePluginInstance('test2code');
  if (plugin.isTest2CodePlugin()) {
    req.drillCtx.plugins = {
      test2Code: plugin,
    };
    next();
    return;
  }
  throw new Error('failed to obtain test2code plugin'); // should never happen, if ensurePluginInstance implementation is correct
}
