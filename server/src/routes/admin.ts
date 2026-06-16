import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = Router();

// All departments queue status (admin)
router.get('/queues', authMiddleware(['admin']), (_req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);

  const departments = db.prepare('SELECT * FROM departments ORDER BY id').all() as any[];
  const result = departments.map((dept: any) => {
    const doctors = db.prepare(
      'SELECT id, name, title FROM doctors WHERE department_id = ?'
    ).all(dept.id) as any[];

    const doctorDetails = doctors.map((doc: any) => {
      const serving = db.prepare(`
        SELECT a.queue_number, p.name as patient_name
        FROM appointments a JOIN patients p ON a.patient_id = p.id
        WHERE a.doctor_id = ? AND a.date = ? AND a.status = 'serving'
      `).get(doc.id, today) as any;

      const waiting = db.prepare(
        "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND date = ? AND status = 'waiting'"
      ).get(doc.id, today) as any;

      const completed = db.prepare(
        "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND date = ? AND status = 'completed'"
      ).get(doc.id, today) as any;

      return {
        ...doc,
        current_number: serving?.queue_number || null,
        current_patient: serving?.patient_name || null,
        waiting: waiting.count,
        completed: completed.count,
      };
    });

    const totalWaiting = doctorDetails.reduce((s: number, d: any) => s + d.waiting, 0);
    const totalCompleted = doctorDetails.reduce((s: number, d: any) => s + d.completed, 0);

    return { ...dept, doctors: doctorDetails, total_waiting: totalWaiting, total_completed: totalCompleted };
  });

  res.json(result);
});

// Daily statistics
router.get('/stats', authMiddleware(['admin']), (req: Request, res: Response) => {
  const { start_date, end_date } = req.query;
  const start = (start_date as string) || new Date().toISOString().slice(0, 10);
  const end = (end_date as string) || start;

  const dailyStats = db.prepare(`
    SELECT a.date, dep.name as department_name, COUNT(*) as total,
      SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN a.status IN ('waiting', 'serving') THEN 1 ELSE 0 END) as pending
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    JOIN departments dep ON d.department_id = dep.id
    WHERE a.date BETWEEN ? AND ?
    GROUP BY a.date, dep.name
    ORDER BY a.date DESC, dep.name
  `).all(start, end);

  const totalStats = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
      SUM(CASE WHEN status = 'serving' THEN 1 ELSE 0 END) as serving
    FROM appointments
    WHERE date BETWEEN ? AND ?
  `).get(start, end);

  // Per department summary
  const deptSummary = db.prepare(`
    SELECT dep.name as department_name, COUNT(*) as total,
      SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    JOIN departments dep ON d.department_id = dep.id
    WHERE a.date BETWEEN ? AND ?
    GROUP BY dep.name ORDER BY total DESC
  `).all(start, end);

  res.json({ daily: dailyStats, total: totalStats, by_department: deptSummary });
});

// List all patients (admin)
router.get('/patients', authMiddleware(['admin']), (_req: Request, res: Response) => {
  const patients = db.prepare('SELECT id, username, name, phone FROM patients ORDER BY id').all();
  res.json(patients);
});

// List all doctors (admin)
router.get('/doctors', authMiddleware(['admin']), (_req: Request, res: Response) => {
  const doctors = db.prepare(`
    SELECT d.id, d.username, d.name, d.title, dep.name as department_name
    FROM doctors d JOIN departments dep ON d.department_id = dep.id
    ORDER BY dep.id, d.id
  `).all();
  res.json(doctors);
});

export default router;
