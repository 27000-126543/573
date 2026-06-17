import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', (req: Request, res: Response): void => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: '用户名和密码不能为空' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

  if (!user) {
    res.status(401).json({ message: '用户名或密码错误' });
    return;
  }

  const isValidPassword = bcrypt.compareSync(password, user.password);

  if (!isValidPassword) {
    res.status(401).json({ message: '用户名或密码错误' });
    return;
  }

  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET || 'asset_management_secret_key_2024',
    { expiresIn: '24h' }
  );

  res.json({
    message: '登录成功',
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department
    }
  });
});

router.get('/profile', authenticate, (req: AuthRequest, res: Response): void => {
  res.json({
    user: req.user
  });
});

router.get('/users', authenticate, (req: AuthRequest, res: Response): void => {
  const users = db.prepare('SELECT id, username, name, role, department, created_at FROM users').all();
  res.json({ users });
});

export default router;
