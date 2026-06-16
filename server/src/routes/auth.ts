import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { signToken, AuthPayload } from '../auth';

const router = Router();

// Patient register
router.post('/register', (req: Request, res: Response) => {
  const { username, password, name, phone, id_card } = req.body;
  if (!username || !password || !name || !phone) {
    res.status(400).json({ message: '请填写完整注册信息' });
    return;
  }
  const existing = db.prepare('SELECT id FROM patients WHERE username = ?').get(username);
  if (existing) {
    res.status(400).json({ message: '用户名已存在' });
    return;
  }
  const salt = bcrypt.genSaltSync(10);
  const hashed = bcrypt.hashSync(password, salt);
  const info = db.prepare(
    'INSERT INTO patients (username, password, name, phone, id_card) VALUES (?, ?, ?, ?, ?)'
  ).run(username, hashed, name, phone, id_card || '');

  const payload: AuthPayload = { id: Number(info.lastInsertRowid), role: 'patient', username };
  res.json({ token: signToken(payload), user: { id: payload.id, name, role: 'patient' } });
});

// Patient login
router.post('/login/patient', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM patients WHERE username = ?').get(username) as any;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ message: '用户名或密码错误' });
    return;
  }
  const payload: AuthPayload = { id: user.id, role: 'patient', username: user.username };
  res.json({ token: signToken(payload), user: { id: user.id, name: user.name, role: 'patient' } });
});

// Doctor login
router.post('/login/doctor', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM doctors WHERE username = ?').get(username) as any;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ message: '用户名或密码错误' });
    return;
  }
  const payload: AuthPayload = { id: user.id, role: 'doctor', username: user.username };
  res.json({ token: signToken(payload), user: { id: user.id, name: user.name, role: 'doctor' } });
});

// Admin login
router.post('/login/admin', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM admins WHERE username = ?').get(username) as any;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ message: '用户名或密码错误' });
    return;
  }
  const payload: AuthPayload = { id: user.id, role: 'admin', username: user.username };
  res.json({ token: signToken(payload), user: { id: user.id, name: '管理员', role: 'admin' } });
});

// Get current user info
router.get('/me', (req: Request, res: Response) => {
  if (!req.user) { res.status(401).json({ message: '未登录' }); return; }
  const { id, role, username } = req.user;
  if (role === 'patient') {
    const user = db.prepare('SELECT id, username, name, phone FROM patients WHERE id = ?').get(id);
    res.json(user);
  } else if (role === 'doctor') {
    const user = db.prepare('SELECT id, username, name, title, department_id FROM doctors WHERE id = ?').get(id);
    res.json(user);
  } else {
    res.json({ id, username, name: '管理员' });
  }
});

export default router;
