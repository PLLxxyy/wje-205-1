import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// List all departments
router.get('/', (_req: Request, res: Response) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY id').all();
  res.json(departments);
});

// Get department by id with doctors
router.get('/:id', (req: Request, res: Response) => {
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!dept) { res.status(404).json({ message: '科室不存在' }); return; }
  const doctors = db.prepare(
    'SELECT id, name, title, bio FROM doctors WHERE department_id = ? ORDER BY id'
  ).all(req.params.id);
  res.json({ ...dept as any, doctors });
});

// List all doctors with department info
router.get('/doctors/all', (_req: Request, res: Response) => {
  const doctors = db.prepare(`
    SELECT d.id, d.name, d.title, d.bio, dep.name as department_name, dep.id as department_id
    FROM doctors d JOIN departments dep ON d.department_id = dep.id
    ORDER BY dep.id, d.id
  `).all();
  res.json(doctors);
});

export default router;
