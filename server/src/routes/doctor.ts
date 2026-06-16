import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = Router();

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
