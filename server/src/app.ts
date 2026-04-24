import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { authRouter } from './features/auth/auth.routes';
import { clientsRouter } from './features/clients/clients.routes';
import { productsRouter } from './features/products/products.routes';
import { kitsRouter } from './features/kits/kits.routes';
import { quotesRouter } from './features/quotes/quotes.routes';
import { fixedExpensesRouter } from './features/fixed-expenses/fixed-expenses.routes';
import { financeRouter } from './features/finance/finance.routes';
import { usersRouter } from './features/users/users.routes';
import { organizationsRouter } from './features/organizations/organizations.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/clients', clientsRouter);
app.use('/products', productsRouter);
app.use('/kits', kitsRouter);
app.use('/quotes', quotesRouter);
app.use('/fixed-expenses', fixedExpensesRouter);
app.use('/finance', financeRouter);
app.use('/users', usersRouter);
app.use('/organizations', organizationsRouter);

// Centralized error handler — must be last
app.use(errorHandler);

export default app;
