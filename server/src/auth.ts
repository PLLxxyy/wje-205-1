import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hospital-queue-secret-2026';

export interface AuthPayload {
  id: number;
  role: 'patient' | 'doctor' | 'admin';
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(roles?: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: '未登录，请先登录' });
      return;
    }
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
      if (roles && !roles.includes(decoded.role)) {
        res.status(403).json({ message: '无权访问' });
        return;
      }
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ message: '登录已过期，请重新登录' });
    }
  };
}
