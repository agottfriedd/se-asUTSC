import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  uid?:  string;
  role?: 'student' | 'admin';
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  req.uid  = 'dev-user';
  req.role = 'admin';
  next();
}

export async function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  req.uid  = 'dev-user';
  req.role = 'admin';
  next();
}