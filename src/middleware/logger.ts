import { Request, Response } from 'express';

export default (logger) => (req: Request, resp: Response, next: any) => {
  logger.info('request:', req.method, req.path);
  next();
};
