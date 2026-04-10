import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { SCHEDULE_EXCEPTION_ERRORS, HTTP_STATUS } from '../constants/errors';
import { SLOT_DURATION_MINUTES } from '../constants/appointments';
import { success, error } from '../utils/response';
import { formatTimeFromDate, isTimeWithinRange } from '../utils/time';
import { getDayBoundaries } from '../utils/dateRanges';
import { processRefundInTransaction } from '../utils/refund';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface AppointmentWithPaymentAndPatient {
  id: string;
  dateTime: Date;
  patient: { id: string; name: string; email: string };
  payment: { id: string; stripePaymentIntentId: string; status: string } | null;
}

export async function getScheduleExceptions(req: Request, res: Response, next: NextFunction) {
  try {
    const physioId = req.user!.id;

    const exceptions = await prisma.scheduleException.findMany({
      where: { physioId },
      orderBy: { date: 'asc' },
    });

    res.json(success(exceptions));
  } catch (err) {
    next(err);
  }
}

function isAppointmentCoveredByException(
  appointmentDateTime: Date,
  isWorkingDay: boolean,
  startTime: string | null,
  endTime: string | null
): boolean {
  if (!isWorkingDay || !startTime || !endTime) return false;

  const appointmentTime = formatTimeFromDate(appointmentDateTime);
  return isTimeWithinRange(appointmentTime, startTime, endTime, SLOT_DURATION_MINUTES);
}

export async function createScheduleException(req: Request, res: Response, next: NextFunction) {
  try {
    const physioId = req.user!.id;
    const { date, isWorkingDay, startTime, endTime, confirmCancellation } = req.body;

    const exceptionDate = new Date(date);
    const dayBoundaries = getDayBoundaries(exceptionDate);

    const confirmedAppointments = await prisma.appointment.findMany({
      where: {
        physioId,
        status: 'CONFIRMED',
        dateTime: { gte: dayBoundaries.start, lte: dayBoundaries.end },
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        payment: { select: { id: true, stripePaymentIntentId: true, status: true } },
      },
    });

    const conflictingAppointments = confirmedAppointments.filter(
      (apt: AppointmentWithPaymentAndPatient) => !isAppointmentCoveredByException(apt.dateTime, isWorkingDay, startTime, endTime)
    );

    if (conflictingAppointments.length > 0 && !confirmCancellation) {
      res.status(SCHEDULE_EXCEPTION_ERRORS.APPOINTMENTS_CONFLICT.status).json(
        error(SCHEDULE_EXCEPTION_ERRORS.APPOINTMENTS_CONFLICT, {
          conflictingAppointments: conflictingAppointments.map((apt: AppointmentWithPaymentAndPatient) => ({
            id: apt.id,
            dateTime: apt.dateTime,
            patient: apt.patient,
          })),
        })
      );
      return;
    }

    const exception = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      for (const apt of conflictingAppointments) {
        await tx.appointment.update({
          where: { id: apt.id },
          data: { status: 'CANCELLED', cancelledById: physioId },
        });

        await processRefundInTransaction(tx, apt.payment, apt.id);
      }

      return tx.scheduleException.create({
        data: {
          physioId,
          date: exceptionDate,
          isWorkingDay,
          startTime: isWorkingDay ? startTime : null,
          endTime: isWorkingDay ? endTime : null,
        },
      });
    });

    res.status(HTTP_STATUS.CREATED).json(
      success({
        exception,
        cancelledAppointments: conflictingAppointments.map((apt: AppointmentWithPaymentAndPatient) => apt.id),
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function deleteScheduleException(req: Request, res: Response, next: NextFunction) {
  try {
    const exception = req.scheduleException!;

    await prisma.scheduleException.delete({ where: { id: exception.id } });

    res.json(success({ deleted: true }));
  } catch (err) {
    next(err);
  }
}
