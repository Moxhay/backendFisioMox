import { Router } from 'express';
import { setWorkSchedule, getWorkSchedule } from '../controllers/workSchedule.controller';
import { authenticate } from '../middleware/auth.middleware';
import { workScheduleLimiter } from '../middleware/rateLimiter.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateWorkSchedule } from '../middleware/workSchedule.validation';

export const workScheduleRouter = Router();

workScheduleRouter.get('/', workScheduleLimiter, authenticate, requireRole('PHYSIO', 'ADMIN'), getWorkSchedule);
workScheduleRouter.put('/', workScheduleLimiter, authenticate, requireRole('PHYSIO', 'ADMIN'), validateWorkSchedule, setWorkSchedule);