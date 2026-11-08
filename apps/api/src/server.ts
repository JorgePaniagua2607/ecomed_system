import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes';
import staffRoutes from './routes/staff.routes';
import doctorRoutes from './routes/doctor.routes';
import studyRoutes from './routes/study.routes';
import patientRoutes from './routes/patient.routes';
import orderRoutes from './routes/order.routes';
import paymentRoutes from './routes/payment.routes';
import queueRoutes from './routes/queue.routes';
import reportFormatRoutes from './routes/report-format.routes';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Healthchecks compatibles con Fase 1 (/api/health) y Fase 5 (/api/v1/health)
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    status: 'OK',
    message: 'Servidor API Ecomed operativo.',
    timestamp: new Date().toISOString(),
  });
};

app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// Rutas de las Fases 1 a 5
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/studies', studyRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/queue', queueRoutes);
app.use('/api/v1/report-formats', reportFormatRoutes);
app.use('/api/v1/reports', reportFormatRoutes);

// Manejador 404 en JSON
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada en la API: ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, () => {
  console.log(`Servidor API corriendo en http://localhost:${PORT}`);
});

export default app;
