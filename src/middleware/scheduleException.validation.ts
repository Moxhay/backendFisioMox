import { body, param } from 'express-validator';
import { handleValidationErrors } from './validation.middleware';
import { timeToMinutes } from '../utils/time';

export const validateCreateScheduleException = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be in YYYY-MM-DD format')
    .custom((value) => {
      const inputDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (inputDate < today) {
        throw new Error('Date cannot be in the past');
      }
      return true;
    }),
  body('isWorkingDay')
    .notEmpty()
    .withMessage('isWorkingDay is required')
    .isBoolean()
    .withMessage('isWorkingDay must be a boolean'),
  body('startTime')
    .if(body('isWorkingDay').equals('true'))
    .notEmpty()
    .withMessage('startTime is required when isWorkingDay is true')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('startTime must be in HH:mm format'),
  body('endTime')
    .if(body('isWorkingDay').equals('true'))
    .notEmpty()
    .withMessage('endTime is required when isWorkingDay is true')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('endTime must be in HH:mm format'),
  body().custom((value) => {
    if (value.isWorkingDay === true && value.startTime && value.endTime) {
      const start = timeToMinutes(value.startTime);
      const end = timeToMinutes(value.endTime);
      if (end <= start) {
        throw new Error('endTime must be greater than startTime');
      }
    }
    return true;
  }),
  body('confirmCancellation').optional().isBoolean().withMessage('confirmCancellation must be a boolean'),
  handleValidationErrors,
];

export const validateScheduleExceptionId = [
  param('id').notEmpty().withMessage('Schedule exception ID is required').isString().trim(),
  handleValidationErrors,
];
