import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HTTP_STATUS, PHYSIO_ERRORS, APPOINTMENT_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

export async function validatePhysioExists(req: Request, res: Response, next: NextFunction) {
  try {
    const physioId = (req.query.physioId || req.params.physioId) as string;

    const physio = await prisma.user.findUnique({
      where: { id: physioId, role: 'PHYSIO' },
      select: { id: true },
    });

    if (!physio) {
      res.status(HTTP_STATUS.NOT_FOUND).json(error(PHYSIO_ERRORS.NOT_FOUND, HTTP_STATUS.NOT_FOUND));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

export async function validatePhysioAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const physioId = req.query.physioId as string || req.body.physioId;
    const date = req.query.date as string || req.body.dateTime?.split('T')[0];

    if (!physioId || !date) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(error(PHYSIO_ERRORS.ID_AND_DATE_REQUIRED, HTTP_STATUS.BAD_REQUEST));
      return;
    }

    const physio = await prisma.user.findUnique({
      where: { id: physioId, role: 'PHYSIO' },
      select: { id: true, pricePerSession: true },
    });

    if (!physio) {
      res.status(HTTP_STATUS.NOT_FOUND).json(error(PHYSIO_ERRORS.NOT_FOUND, HTTP_STATUS.NOT_FOUND));
      return;
    }

    const targetDate = new Date(date);

    const workSchedule = await prisma.workSchedule.findFirst({
      where: { physioId, dayOfWeek: targetDate.getDay() },
    });

    if (!workSchedule) {
      res.status(HTTP_STATUS.NOT_FOUND).json(error(PHYSIO_ERRORS.DOES_NOT_WORK_THIS_DAY, HTTP_STATUS.NOT_FOUND));
      return;
    }

    const exception = await prisma.scheduleException.findFirst({
      where: { physioId, date: targetDate },
    });

    if (exception && !exception.isWorkingDay) {
      res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(error(PHYSIO_ERRORS.DAY_OFF, HTTP_STATUS.UNPROCESSABLE_ENTITY));
      return;
    }

    req.physioSchedule = {
      physio,
      workSchedule,
      exception,
      targetDate,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export async function validateSlotAvailable(req: Request, res: Response, next: NextFunction) {
  try {
    const { physio } = req.physioSchedule!;

    if (!physio.pricePerSession) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(error(PHYSIO_ERRORS.NO_PRICE_CONFIGURED, HTTP_STATUS.BAD_REQUEST));
      return;
    }

    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        physioId: physio.id,
        dateTime: new Date(req.body.dateTime),
        OR: [
          { status: 'CONFIRMED' },
          { status: 'PENDING', expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (existingAppointment) {
      res.status(HTTP_STATUS.CONFLICT).json(error(APPOINTMENT_ERRORS.SLOT_ALREADY_BOOKED, HTTP_STATUS.CONFLICT));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}