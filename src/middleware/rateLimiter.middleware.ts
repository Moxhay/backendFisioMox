import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';
const defaultErrorMessage = 'Too many requests, please try again later';

export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  message: { error: defaultErrorMessage },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

export const authMeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 30,
  message: { error: defaultErrorMessage },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});
export const appointmentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  message: { error: defaultErrorMessage },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});
export const workScheduleLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  message: { error: defaultErrorMessage },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});
export const physioLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  message: { error: defaultErrorMessage },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});
export const scheduleExceptionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  message: { error: defaultErrorMessage },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});
export const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  message: { error: defaultErrorMessage },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});
