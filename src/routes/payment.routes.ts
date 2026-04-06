import { Router } from 'express';
import { getPayments, getPaymentStats, getPaymentExceptions } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { paymentLimiter } from '../middleware/rateLimiter.middleware';
import { validateGetPayments, validateGetPaymentStats } from '../middleware/payment.validation';

export const paymentRouter = Router();

paymentRouter.get('/', paymentLimiter, authenticate, validateGetPayments, getPayments);
paymentRouter.get('/stats', paymentLimiter, authenticate, validateGetPaymentStats, getPaymentStats);
paymentRouter.get('/exceptions', paymentLimiter, authenticate, validateGetPayments, getPaymentExceptions);
