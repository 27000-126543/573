import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/database';

interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    name: string;
    role: string;
    department?: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: '未提供认证令牌' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'asset_management_secret_key_2024') as { id: number };
    const user = db.prepare('SELECT id, username, name, role, department FROM users WHERE id = ?').get(decoded.id) as any;

    if (!user) {
      res.status(401).json({ message: '用户不存在' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: '无效的认证令牌' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: '需要管理员权限' });
    return;
  }
  next();
};

export type { AuthRequest };
