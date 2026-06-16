import express from 'express';
import cors from 'cors';
import { authMiddleware } from './auth';
import authRoutes from './routes/auth';
import departmentRoutes from './routes/departments';
import appointmentRoutes from './routes/appointments';
import doctorRoutes from './routes/doctor';
import queueRoutes from './routes/queue';
import adminRoutes from './routes/admin';

const app = express();
const PORT = Number(process.env.PORT) || 3205;

app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', (req, res, next) => {
  // Auth routes that don't need token
  if (req.path === '/register' || req.path.startsWith('/login')) {
    next();
    return;
  }
  // /me needs auth
  authMiddleware()(req, res, next);
}, authRoutes);

app.use('/api/departments', departmentRoutes);
app.use('/api/queue', queueRoutes);

// Protected routes
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
