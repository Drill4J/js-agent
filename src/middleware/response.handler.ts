export default async function (req, res, next: any): Promise<void> {
  try {
    // TODO that does not work as express does not support async functions directly
    //      get rid of it and get koa
    const data = await next();
    res.status = 200;
    res.json(data || {});
  } catch (e) {
    res.status = 500; // TODO just for now
    res.json({ message: e.message || 'INTERNAL_SERVER_ERROR' });
  }
}
