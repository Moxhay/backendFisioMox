import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes';
import { webhookRouter } from './routes/webhook.routes';
import { HTTP_STATUS, GENERAL_ERRORS } from './constants/errors';
import { error } from './utils/response';
import { logger } from './utils/logger';

const app = express();

app.use(helmet());
app.use(morgan('dev'));

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use('/api/v1/webhooks', webhookRouter);

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ message: 'API running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json(error('Not found', HTTP_STATUS.NOT_FOUND));
});

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err, { path: req.path, method: req.method });
  res
    .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    .json(error(GENERAL_ERRORS.INTERNAL_SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR));
});

export default app;
