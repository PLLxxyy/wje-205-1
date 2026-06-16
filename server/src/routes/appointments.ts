import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = Router();

// Get available slots for a doctor on a date
router.get('/slots', (req: Request, res: Response) => {
  const { doctor_id, date } = req.query;
  if (!doctor_id || !date) {
    res.status(400).json({ message: '缺少参数' });
    return;
  }
  const slots = db.prepare(`
    SELECT * FROM time_slots
    WHERE doctor_id = ? AND date = ? AND current_appointments < max_appointments
    ORDER BY start_time
  `).all(doctor_id, date);
  res.json(slots);
});

// Book an appointment (patient only)
router.post('/', authMiddleware(['patient']), (req: Request, res: Response) => {
  const { doctor_id, slot_id } = req.body;
  const patient_id = req.user!.id;

  if (!doctor_id || !slot_id) {
    res.status(400).json({ message: '缺少预约信息' });
    return;
  }

  const slot = db.prepare('SELECT * FROM time_slots WHERE id = ?').get(slot_id) as any;
  if (!slot) { res.status(404).json({ message: '时段不存在' }); return; }
  if (slot.current_appointments >= slot.max_appointments) {
    res.status(400).json({ message: '该时段已满' });
    return;
  }

  // Check if patient already has an appointment at this time
  const existing = db.prepare(
    'SELECT id FROM appointments WHERE patient_id = ? AND slot_id = ?'
  ).get(patient_id, slot_id);
  if (existing) {
    res.status(400).json({ message: '您已预约该时段' });
    return;
  }

  // Get next queue number for this doctor on this date
  const lastQueue = db.prepare(
    'SELECT MAX(queue_number) as max_num FROM appointments WHERE doctor_id = ? AND date = ?'
  ).get(doctor_id, slot.date) as any;
  const queueNumber = (lastQueue?.max_num || 0) + 1;

  const txn = db.transaction(() => {
    db.prepare(
      'INSERT INTO appointments (patient_id, doctor_id, slot_id, date, queue_number, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(patient_id, doctor_id, slot_id, slot.date, queueNumber, 'waiting');
    db.prepare(
      'UPDATE time_slots SET current_appointments = current_appointments + 1 WHERE id = ?'
    ).run(slot_id);
  });
  txn();

  res.json({
    message: '预约成功',
    queue_number: queueNumber,
    date: slot.date,
    time: `${slot.start_time} - ${slot.end_time}`,
  });
});

// Get my appointments (patient)
router.get('/mine', authMiddleware(['patient']), (req: Request, res: Response) => {
  const appointments = db.prepare(`
    SELECT a.*, d.name as doctor_name, d.title as doctor_title,
           dep.name as department_name, ts.start_time, ts.end_time
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    JOIN departments dep ON d.department_id = dep.id
    JOIN time_slots ts ON a.slot_id = ts.id
    WHERE a.patient_id = ?
    ORDER BY a.date DESC, a.queue_number
  `).all(req.user!.id);
  res.json(appointments);
});

// Cancel appointment (patient)
router.put('/:id/cancel', authMiddleware(['patient']), (req: Request, res: Response) => {
  const appt = db.prepare(
    'SELECT * FROM appointments WHERE id = ? AND patient_id = ?'
  ).get(req.params.id, req.user!.id) as any;
  if (!appt) { res.status(404).json({ message: '预约不存在' }); return; }
  if (appt.status !== 'waiting') {
    res.status(400).json({ message: '当前状态无法取消' });
    return;
  }
  db.transaction(() => {
    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(appt.id);
    db.prepare(
      'UPDATE time_slots SET current_appointments = MAX(current_appointments - 1, 0) WHERE id = ?'
    ).run(appt.slot_id);
  })();
  res.json({ message: '取消成功' });
});

export default router;
