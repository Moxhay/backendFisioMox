import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HTTP_STATUS, GENERAL_ERRORS, APPOINTMENT_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

const appointmentInclude = {
  physio: { select: { id: true, name: true, email: true, pricePerSession: true } },
  patient: { select: { id: true, name: true, email: true } },
  payment: { select: { id: true, amount: true, status: true, stripePaymentIntentId: true } },
} as const;

export async function validateAppointmentAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const appointmentId = req.params.id as string;

    if (!appointmentId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(error(APPOINTMENT_ERRORS.ID_REQUIRED, HTTP_STATUS.BAD_REQUEST));
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: appointmentInclude,
    });

    if (!appointment) {
      res.status(HTTP_STATUS.NOT_FOUND).json(error(APPOINTMENT_ERRORS.NOT_FOUND, HTTP_STATUS.NOT_FOUND));
      return;
    }

    if (appointment.physioId !== userId && appointment.patientId !== userId) {
      res.status(HTTP_STATUS.FORBIDDEN).json(error(GENERAL_ERRORS.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN));
      return;
    }

    req.appointment = appointment;
    next();
  } catch (err) {
    next(err);
  }
}

export async function validateAppointmentNotExpired(req: Request, res: Response, next: NextFunction) {
  try {
    const appointment = req.appointment!;

    if (appointment.expiresAt && appointment.expiresAt < new Date()) {
      await prisma.appointment.delete({ where: { id: appointment.id } });
      res.status(HTTP_STATUS.BAD_REQUEST).json(error(APPOINTMENT_ERRORS.RESERVATION_EXPIRED, HTTP_STATUS.BAD_REQUEST));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

export function validateAppointmentNotCancelled(req: Request, res: Response, next: NextFunction) {
  if (req.appointment!.status === 'CANCELLED') {
    res.status(HTTP_STATUS.BAD_REQUEST).json(error(APPOINTMENT_ERRORS.ALREADY_CANCELLED, HTTP_STATUS.BAD_REQUEST));
    return;
  }
  next();
}

export async function validatePendingAppointmentOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const appointmentId = (req.params.id || req.body.appointmentId) as string;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: appointmentInclude,
    });

    if (!appointment) {
      res.status(HTTP_STATUS.NOT_FOUND).json(error(APPOINTMENT_ERRORS.NOT_FOUND, HTTP_STATUS.NOT_FOUND));
      return;
    }

    if (appointment.patientId !== userId) {
      res.status(HTTP_STATUS.FORBIDDEN).json(error(GENERAL_ERRORS.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN));
      return;
    }

    if (appointment.status !== 'PENDING') {
      res.status(HTTP_STATUS.BAD_REQUEST).json(error(APPOINTMENT_ERRORS.NOT_PENDING, HTTP_STATUS.BAD_REQUEST));
      return;
    }

    req.appointment = appointment;
    next();
  } catch (err) {
    next(err);
  }
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function validateCancellationTime(req: Request, res: Response, next: NextFunction) {
  const isPhysio = req.user!.id === req.appointment!.physioId;

  if (isPhysio) {
    next();
    return;
  }

  const appointmentTime = new Date(req.appointment!.dateTime).getTime();
  const now = Date.now();

  if (appointmentTime - now < TWO_HOURS_MS) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(error(APPOINTMENT_ERRORS.TOO_LATE_TO_CANCEL, HTTP_STATUS.BAD_REQUEST));
    return;
  }
  next();
}