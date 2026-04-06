import { query } from 'express-validator';
import { handleValidationErrors } from './validation.middleware';

export const validateGetPayments = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('month')
    .optional()
    .matches(/^\d{4}-\d{2}$/)
    .withMessage('Month must be in YYYY-MM format'),
  handleValidationErrors,
];

export const validateGetPaymentStats = [
  query('month')
    .optional()
    .matches(/^\d{4}-\d{2}$/)
    .withMessage('Month must be in YYYY-MM format'),
  handleValidationErrors,
];
