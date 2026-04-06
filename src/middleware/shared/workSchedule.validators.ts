import { body } from 'express-validator';
import { timeToMinutes } from '../../utils/time';

export interface WorkScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const hasOverlap = (a: WorkScheduleInput, b: WorkScheduleInput): boolean => {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
};

export const workScheduleDayOfWeek = (path: string) =>
  body(path)
    .isInt({ min: 0, max: 6 })
    .withMessage('dayOfWeek must be an integer between 0 and 6');

export const workScheduleStartTime = (path: string) =>
  body(path)
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('startTime must be in HH:mm format');

export const workScheduleEndTime = (path: string) =>
  body(path)
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('endTime must be in HH:mm format');

export const workScheduleTimeOrder = (path: string) =>
  body(path).custom((schedule: WorkScheduleInput) => {
    const start = timeToMinutes(schedule.startTime);
    const end = timeToMinutes(schedule.endTime);
    if (end <= start) {
      throw new Error('endTime must be greater than startTime');
    }
    return true;
  });

export const workScheduleNoOverlap = (path: string) =>
  body(path).custom((schedules: WorkScheduleInput[]) => {
    if (!Array.isArray(schedules)) return true;
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        if (hasOverlap(schedules[i], schedules[j])) {
          throw new Error(`Schedules overlap on day ${schedules[i].dayOfWeek}`);
        }
      }
    }
    return true;
  });