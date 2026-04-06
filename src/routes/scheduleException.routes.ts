import { Router } from 'express';
import {
  getScheduleExceptions,
  createScheduleException,
  deleteScheduleException,
} from '../controllers/scheduleException.controller';
import { authenticate } from '../middleware/auth.middleware';
import { scheduleExceptionLimiter } from '../middleware/rateLimiter.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  validateCreateScheduleException,
  validateScheduleExceptionId,
} from '../middleware/scheduleException.validation';
import {
  validateNoDuplicateException,
  validateScheduleExceptionOwnership,
} from '../middleware/scheduleExceptionAccess.middleware';

export const scheduleExceptionRouter = Router();

scheduleExceptionRouter.get(
  '/',
  scheduleExceptionLimiter,
  authenticate,
  requireRole('PHYSIO', 'ADMIN'),
  getScheduleExceptions
);

scheduleExceptionRouter.post(
  '/',
  scheduleExceptionLimiter,
  authenticate,
  requireRole('PHYSIO', 'ADMIN'),
  validateCreateScheduleException,
  validateNoDuplicateException,
  createScheduleException
);

scheduleExceptionRouter.delete(
  '/:id',
  scheduleExceptionLimiter,
  authenticate,
  requireRole('PHYSIO', 'ADMIN'),
  validateScheduleExceptionId,
  validateScheduleExceptionOwnership,
  deleteScheduleException
);
