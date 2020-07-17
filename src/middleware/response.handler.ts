import { ExtendableContext, Next } from 'koa';

export default async function (ctx: ExtendableContext, next: Next): Promise<void> {
  try {
    const data = await next();
    ctx.response.status = 200;
    if (data) {
      ctx.response.body = data;
    }
  } catch (e) {
    this.logger.error('%O', e);
    ctx.response.status = e.status || 500;
    ctx.response.body = { message: e.message || 'INTERNAL_SERVER_ERROR' };
  }
}
