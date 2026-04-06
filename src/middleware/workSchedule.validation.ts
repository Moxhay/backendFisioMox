import { body } from 'express-validator';
import { handleValidationErrors } from './validation.middleware';
import {
  workScheduleDayOfWeek,
  workScheduleStartTime,
  workScheduleEndTime,
  workScheduleTimeOrder,
  workScheduleNoOverlap,
} from './shared/workSchedule.validators';

export const validateWorkSchedule = [
  body('schedules').isArray().withMessage('schedules must be an array'),
  workScheduleDayOfWeek('schedules.*.dayOfWeek'),
  workScheduleStartTime('schedules.*.startTime'),
  workScheduleEndTime('schedules.*.endTime'),
  workScheduleTimeOrder('schedules.*'),
  workScheduleNoOverlap('schedules'),
  body('confirmCancellation').optional().isBoolean().withMessage('confirmCancellation must be a boolean'),
  handleValidationErrors,
];