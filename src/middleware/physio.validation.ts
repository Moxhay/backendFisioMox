import { param, body } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HTTP_STATUS, PHYSIO_ERRORS, GENERAL_ERRORS } from '../constants/errors';
import { error } from '../utils/response';
import { handleValidationErrors } from './validation.middleware';
import { Role } from '../generated/prisma/enums';

export const validatePhysioId = [
  param('id').notEmpty().withMessage('Physio ID is required').isString().trim(),
  handleValidationErrors,
];

export async function validatePhysioExists(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };

    const physio = await prisma.user.findUnique({
      where: { id, role: 'PHYSIO' },
      select: {
        id: true,
        name: true,
        pricePerSession: true,
        workSchedules: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!physio) {
      res.status(HTTP_STATUS.NOT_FOUND).json(error(PHYSIO_ERRORS.NOT_FOUND, HTTP_STATUS.NOT_FOUND));
      return;
    }

    req.physio = physio;
    next();
  } catch (err) {
    next(err);
  }
}

export const validateUpdatePrice = [
  param('id').notEmpty().withMessage('Physio ID is required').isString().trim(),
  body('pricePerSession')
    .notEmpty()
    .withMessage('Price per session is required')
    .isInt({ min: 1 })
    .withMessage('Price per session must be a positive integer'),
  handleValidationErrors,
];

export async function validateCanUpdatePrice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const user = req.user!;

    const physio = await prisma.user.findUnique({
      where: { id, role: 'PHYSIO' },
      select: { id: true },
    });

    if (!physio) {
      res.status(HTTP_STATUS.NOT_FOUND).json(error(PHYSIO_ERRORS.NOT_FOUND, HTTP_STATUS.NOT_FOUND));
      return;
    }

    const isAdmin = user.role === Role.ADMIN;
    const isOwnProfile = user.id === id;

    if (!isAdmin && !isOwnProfile) {
      res.status(HTTP_STATUS.FORBIDDEN).json(error(GENERAL_ERRORS.FORBIDDEN, HTTP_STATUS.FORBIDDEN));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
