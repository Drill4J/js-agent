import Koa from 'koa';

export default logger => async (ctx: Koa.Context, next: Koa.Next): Promise<unknown> => {
  logger.info('request:', ctx.request.method, ctx.request.path);
  return next();
};
