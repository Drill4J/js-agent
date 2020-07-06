export default async function (req, res, next: any): Promise<void> {
  const { agent } = req.drillCtx;
  if (!agent) {
    throw new Error('Agent not found');
  }
  const plugin = agent.ensurePluginInstance('test2code');
  req.drillCtx.plugin = plugin;
  next();
}
