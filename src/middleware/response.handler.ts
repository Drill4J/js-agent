import { ExtendableContext, Next } from 'koa';

export default async function (ctx: ExtendableContext, next: Next): Promise<void> {
  try {
    const data = await next();
    ctx.ok(data);
  } catch (e) {
    ctx.response.status = e.status || 500;
    ctx.response.body = { message: e.message || 'INTERNAL_SERVER_ERROR' };
  }
}
