import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import staffRoutes from './routes/staff.routes';
import doctorRoutes from './routes/doctor.routes';
import studyRoutes from './routes/study.routes';
import patientRoutes from './routes/patient.routes';
import orderRoutes from './routes/order.routes';
import paymentRoutes from './routes/payment.routes';
import queueRoutes from './routes/queue.routes';
import reportFormatRoutes from './routes/report-format.routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Rutas de la API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/studies', studyRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/report-formats', reportFormatRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Backend Ecomed funcionando 🚀' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor API corriendo en http://localhost:${PORT}`);
});
