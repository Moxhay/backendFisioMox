import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { PHYSIO_ERRORS, APPOINTMENT_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

export async function validatePhysioExists(req: Request, res: Response, next: NextFunction) {
  try {
    const physioId = (req.query.physioId || req.params.physioId) as string;

    const physio = await prisma.user.findUnique({
      where: { id: physioId, role: 'PHYSIO' },
      select: { id: true },
    });

    if (!physio) {
      res.status(PHYSIO_ERRORS.NOT_FOUND.status).json(error(PHYSIO_ERRORS.NOT_FOUND));
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
      res.status(PHYSIO_ERRORS.ID_AND_DATE_REQUIRED.status).json(error(PHYSIO_ERRORS.ID_AND_DATE_REQUIRED));
      return;
    }

    const physio = await prisma.user.findUnique({
      where: { id: physioId, role: 'PHYSIO' },
      select: { id: true, pricePerSession: true },
    });

    if (!physio) {
      res.status(PHYSIO_ERRORS.NOT_FOUND.status).json(error(PHYSIO_ERRORS.NOT_FOUND));
      return;
    }

    const targetDate = new Date(date);

    const workSchedule = await prisma.workSchedule.findFirst({
      where: { physioId, dayOfWeek: targetDate.getDay() },
    });

    if (!workSchedule) {
      res.status(PHYSIO_ERRORS.DOES_NOT_WORK_THIS_DAY.status).json(error(PHYSIO_ERRORS.DOES_NOT_WORK_THIS_DAY));
      return;
    }

    const exception = await prisma.scheduleException.findFirst({
      where: { physioId, date: targetDate },
    });

    if (exception && !exception.isWorkingDay) {
      res.status(PHYSIO_ERRORS.DAY_OFF.status).json(error(PHYSIO_ERRORS.DAY_OFF));
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
      res.status(PHYSIO_ERRORS.NO_PRICE_CONFIGURED.status).json(error(PHYSIO_ERRORS.NO_PRICE_CONFIGURED));
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
      res.status(APPOINTMENT_ERRORS.SLOT_ALREADY_BOOKED.status).json(error(APPOINTMENT_ERRORS.SLOT_ALREADY_BOOKED));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
