import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { authRouter } from './features/auth/auth.routes';
import { clientsRouter } from './features/clients/clients.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/clients', clientsRouter);

// Centralized error handler — must be last
app.use(errorHandler);

export default app;
