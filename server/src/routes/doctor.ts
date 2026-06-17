import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = Router();

// Get doctor detail (public)
router.get('/detail/:id', (req: Request, res: Response) => {
  const doctor = db.prepare(`
    SELECT d.id, d.name, d.title, d.bio, d.avatar,
           dep.id as department_id, dep.name as department_name
    FROM doctors d
    JOIN departments dep ON d.department_id = dep.id
    WHERE d.id = ?
  `).get(req.params.id);
  if (!doctor) { res.status(404).json({ message: '医生不存在' }); return; }
  res.json(doctor);
});

// Get doctor's reviews with average rating (public)
router.get('/:id/reviews', (req: Request, res: Response) => {
  const doctorId = req.params.id;

  const stats = db.prepare(`
    SELECT COUNT(*) as review_count,
           AVG(rating) as avg_rating,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as count_5,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as count_4,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as count_3,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as count_2,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as count_1
    FROM reviews WHERE doctor_id = ?
  `).get(doctorId) as any;

  const reviews = db.prepare(`
    SELECT r.*, p.name as patient_name
    FROM reviews r
    JOIN patients p ON r.patient_id = p.id
    WHERE r.doctor_id = ?
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all(doctorId);

  res.json({
    review_count: stats?.review_count || 0,
    avg_rating: stats?.avg_rating ? Number(stats.avg_rating.toFixed(1)) : 0,
    distribution: {
      5: stats?.count_5 || 0,
      4: stats?.count_4 || 0,
      3: stats?.count_3 || 0,
      2: stats?.count_2 || 0,
      1: stats?.count_1 || 0,
    },
    reviews,
  });
});

// Get today's appointment list for doctor
router.get('/appointments', authMiddleware(['doctor']), (req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const doctorId = req.user!.id;
  const appointments = db.prepare(`
    SELECT a.*, p.name as patient_name, p.phone as patient_phone, p.id_card,
           ts.start_time, ts.end_time
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN time_slots ts ON a.slot_id = ts.id
    WHERE a.doctor_id = ? AND a.date = ?
    ORDER BY a.queue_number
  `).all(doctorId, today);
  res.json(appointments);
});

// Call next patient (doctor)
router.post('/call-next', authMiddleware(['doctor']), (req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const doctorId = req.user!.id;

  // Find current serving
  const current = db.prepare(
    "SELECT id FROM appointments WHERE doctor_id = ? AND date = ? AND status = 'serving'"
  ).get(doctorId, today) as any;

  if (current) {
    // Mark current as completed
    db.prepare("UPDATE appointments SET status = 'completed' WHERE id = ?").run(current.id);
  }

  // Find next waiting
  const next = db.prepare(
    "SELECT * FROM appointments WHERE doctor_id = ? AND date = ? AND status = 'waiting' ORDER BY queue_number LIMIT 1"
  ).get(doctorId, today) as any;

  if (!next) {
    res.json({ message: '暂无等待患者', appointment: null });
    return;
  }

  db.prepare("UPDATE appointments SET status = 'serving' WHERE id = ?").run(next.id);

  const patient = db.prepare('SELECT name, phone, id_card FROM patients WHERE id = ?').get(next.patient_id);
  res.json({
    message: '已叫号',
    appointment: { ...next, status: 'serving', ...(patient as any) },
  });
});

// Write diagnosis (doctor)
router.put('/appointments/:id/diagnosis', authMiddleware(['doctor']), (req: Request, res: Response) => {
  const { diagnosis } = req.body;
  if (!diagnosis) { res.status(400).json({ message: '请填写诊断内容' }); return; }

  const appt = db.prepare(
    'SELECT * FROM appointments WHERE id = ? AND doctor_id = ?'
  ).get(req.params.id, req.user!.id);
  if (!appt) { res.status(404).json({ message: '预约记录不存在' }); return; }

  db.prepare('UPDATE appointments SET diagnosis = ? WHERE id = ?').run(diagnosis, req.params.id);
  res.json({ message: '诊断记录已保存' });
});

export default router;
