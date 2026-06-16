import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// Queue display for a specific department
router.get('/department/:id', (req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const deptId = req.params.id;

  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId);
  if (!dept) { res.status(404).json({ message: '科室不存在' }); return; }

  // Current serving per doctor
  const doctors = db.prepare(
    'SELECT id, name, title FROM doctors WHERE department_id = ?'
  ).all(deptId) as any[];

  const results = doctors.map((doc: any) => {
    const serving = db.prepare(`
      SELECT a.*, p.name as patient_name
      FROM appointments a JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = ? AND a.date = ? AND a.status = 'serving'
    `).get(doc.id, today) as any;

    const waiting = db.prepare(
      "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND date = ? AND status = 'waiting'"
    ).get(doc.id, today) as any;

    const avgWait = db.prepare(`
      SELECT AVG(
        CASE WHEN a2.status IN ('serving', 'completed')
        THEN (a.queue_number - a2.queue_number) * 10 ELSE NULL END
      ) as avg_minutes
      FROM appointments a
      LEFT JOIN appointments a2 ON a2.doctor_id = a.doctor_id AND a2.date = a.date AND a2.status IN ('serving', 'completed')
      WHERE a.doctor_id = ? AND a.date = ? AND a.status = 'waiting'
    `).get(doc.id, today) as any;

    return {
      doctor: doc,
      current: serving ? { queue_number: serving.queue_number, patient_name: serving.patient_name } : null,
      waiting_count: waiting.count,
      estimated_wait: Math.max(0, Math.round(avgWait?.avg_minutes || waiting.count * 10)),
    };
  });

  res.json({ department: dept, doctors: results });
});

// All departments queue overview
router.get('/overview', (_req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);

  const departments = db.prepare('SELECT * FROM departments ORDER BY id').all() as any[];
  const overview = departments.map((dept: any) => {
    const totalWaiting = db.prepare(`
      SELECT COUNT(*) as count FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE d.department_id = ? AND a.date = ? AND a.status = 'waiting'
    `).get(dept.id, today) as any;

    const totalServing = db.prepare(`
      SELECT COUNT(*) as count FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE d.department_id = ? AND a.date = ? AND a.status = 'serving'
    `).get(dept.id, today) as any;

    const totalCompleted = db.prepare(`
      SELECT COUNT(*) as count FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE d.department_id = ? AND a.date = ? AND a.status = 'completed'
    `).get(dept.id, today) as any;

    return {
      ...dept,
      waiting: totalWaiting.count,
      serving: totalServing.count,
      completed: totalCompleted.count,
      total_today: totalWaiting.count + totalServing.count + totalCompleted.count,
    };
  });

  res.json(overview);
});

// Public queue display (大屏)
router.get('/display/:departmentId', (req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const deptId = req.params.departmentId;

  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId) as any;
  if (!dept) { res.status(404).json({ message: '科室不存在' }); return; }

  const doctors = db.prepare(
    'SELECT id, name, title FROM doctors WHERE department_id = ?'
  ).all(deptId) as any[];

  const doctorQueues = doctors.map((doc: any) => {
    const serving = db.prepare(`
      SELECT a.queue_number, p.name as patient_name
      FROM appointments a JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = ? AND a.date = ? AND a.status = 'serving'
    `).get(doc.id, today) as any;

    const waitingList = db.prepare(`
      SELECT a.queue_number, p.name as patient_name
      FROM appointments a JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = ? AND a.date = ? AND a.status = 'waiting'
      ORDER BY a.queue_number
    `).all(doc.id, today);

    const completedCount = db.prepare(
      "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND date = ? AND status = 'completed'"
    ).get(doc.id, today) as any;

    const estimatedWait = waitingList.length * 10;

    return {
      doctor: doc,
      current: serving ? { queue_number: serving.queue_number, patient_name: serving.patient_name } : null,
      waiting: waitingList,
      waiting_count: waitingList.length,
      completed_count: completedCount.count,
      estimated_wait_minutes: estimatedWait,
    };
  });

  res.json({ department: dept, doctor_queues: doctorQueues, date: today });
});

export default router;
