import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HTTP_STATUS, SCHEDULE_EXCEPTION_ERRORS, GENERAL_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

export async function validateNoDuplicateException(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const physioId = req.user!.id;
    const { date } = req.body;

    const existingException = await prisma.scheduleException.findFirst({
      where: {
        physioId,
        date: new Date(date),
      },
    });

    if (existingException) {
      res.status(HTTP_STATUS.CONFLICT).json(error(SCHEDULE_EXCEPTION_ERRORS.ALREADY_EXISTS, HTTP_STATUS.CONFLICT));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

export async function validateScheduleExceptionOwnership(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const physioId = req.user!.id;
    const { id } = req.params as { id: string };

    const exception = await prisma.scheduleException.findUnique({
      where: { id },
    });

    if (!exception) {
      res.status(HTTP_STATUS.NOT_FOUND).json(error(SCHEDULE_EXCEPTION_ERRORS.NOT_FOUND, HTTP_STATUS.NOT_FOUND));
      return;
    }

    if (exception.physioId !== physioId) {
      res.status(HTTP_STATUS.FORBIDDEN).json(error(GENERAL_ERRORS.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN));
      return;
    }

    req.scheduleException = exception;
    next();
  } catch (err) {
    next(err);
  }
}
