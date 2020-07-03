import { Request, Response } from 'express';

export default (req: Request, resp: Response, next: any) => {
  console.log('Request:', req.method, req.path);
  next();
};
