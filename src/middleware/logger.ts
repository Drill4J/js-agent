import { Request, Response } from 'express';

export const loggerMiddleware = (req: Request, resp: Response, next: any) => {
  console.log('Request:', req.method, req.path);
  next();
};
