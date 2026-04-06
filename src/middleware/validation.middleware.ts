import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { validationError } from '../utils/response';
import {
  workScheduleDayOfWeek,
  workScheduleStartTime,
  workScheduleEndTime,
  workScheduleTimeOrder,
  workScheduleNoOverlap,
} from './shared/workSchedule.validators';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(validationError(errors.array()));
    return;
  }
  next();
};

const emailNotRegistered = body('email').custom(async (email) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('Email already registered');
  }
});

export const validateRegister = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  emailNotRegistered,
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  handleValidationErrors,
];

export const validateRegisterPhysio = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  emailNotRegistered,
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('pricePerSession')
    .notEmpty()
    .withMessage('Price per session is required')
    .isInt({ min: 1 })
    .withMessage('Price per session must be a positive integer'),
  body('workSchedules')
    .notEmpty()
    .withMessage('Work schedules are required')
    .isArray({ min: 1 })
    .withMessage('At least one work schedule is required'),
  workScheduleDayOfWeek('workSchedules.*.dayOfWeek'),
  workScheduleStartTime('workSchedules.*.startTime'),
  workScheduleEndTime('workSchedules.*.endTime'),
  workScheduleTimeOrder('workSchedules.*'),
  workScheduleNoOverlap('workSchedules'),
  handleValidationErrors,
];

export const validateLogin = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];
