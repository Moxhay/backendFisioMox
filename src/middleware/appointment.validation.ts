import { body, query, param } from 'express-validator';
import { handleValidationErrors } from './validation.middleware';

export const validateAppointmentId = [
  param('id')
    .notEmpty()
    .withMessage('Appointment ID is required')
    .isString()
    .trim(),
  handleValidationErrors,
];

export const validateGetWeekSlots = [
  query('physioId')
    .notEmpty()
    .withMessage('Physio ID is required')
    .isString()
    .trim(),
  query('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be in YYYY-MM-DD format'),
  handleValidationErrors,
];

export const validateReserveAppointment = [
  body('physioId')
    .notEmpty()
    .withMessage('Physio ID is required')
    .isString()
    .trim(),
  body('dateTime')
    .notEmpty()
    .withMessage('DateTime is required')
    .isISO8601()
    .withMessage('DateTime must be in ISO8601 format')
    .custom((value) => {
      const inputDate = new Date(value);
      const now = new Date();
      if (inputDate < now) {
        throw new Error('DateTime cannot be in the past');
      }
      return true;
    }),
  body('notes')
    .optional()
    .isString()
    .trim(),
  handleValidationErrors,
];

export const validateProcessPayment = [
  body('appointmentId')
    .notEmpty()
    .withMessage('Appointment ID is required')
    .isString()
    .trim(),
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required')
    .isString()
    .trim(),
  handleValidationErrors,
];

export const validateGetMyAppointments = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  handleValidationErrors,
];

export const validateGetMyWeekAppointments = [
  query('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be in YYYY-MM-DD format'),
  handleValidationErrors,
];

export const validateGetStats = [
  query('period')
    .optional()
    .isIn(['week', 'month'])
    .withMessage('Period must be "week" or "month"'),
  handleValidationErrors,
];

export const validateGetCompareStats = [handleValidationErrors];