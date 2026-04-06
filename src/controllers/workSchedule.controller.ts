import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { success, error } from '../utils/response';
import { formatTimeFromDate, isTimeWithinRange } from '../utils/time';
import { HTTP_STATUS, WORK_SCHEDULE_ERRORS } from '../constants/errors';
import { SLOT_DURATION_MINUTES } from '../constants/appointments';
import { processRefundInTransaction } from '../utils/refund';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface AppointmentWithPaymentAndPatient {
  id: string;
  dateTime: Date;
  patient: { id: string; name: string; email: string };
  payment: { id: string; stripePaymentIntentId: string; status: string } | null;
}

interface WorkScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface SetWorkScheduleBody {
  schedules: WorkScheduleInput[];
  confirmCancellation?: boolean;
}

function isAppointmentCoveredBySchedules(
  appointmentDateTime: Date,
  schedules: WorkScheduleInput[]
): boolean {
  const dayOfWeek = appointmentDateTime.getDay();
  const schedule = schedules.find((s) => s.dayOfWeek === dayOfWeek);
  if (!schedule) return false;

  const appointmentTime = formatTimeFromDate(appointmentDateTime);
  return isTimeWithinRange(appointmentTime, schedule.startTime, schedule.endTime, SLOT_DURATION_MINUTES);
}

export async function setWorkSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { schedules, confirmCancellation }: SetWorkScheduleBody = req.body;

    const confirmedAppointments = await prisma.appointment.findMany({
      where: {
        physioId: userId,
        status: 'CONFIRMED',
        dateTime: { gt: new Date() },
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        payment: { select: { id: true, stripePaymentIntentId: true, status: true } },
      },
    });

    const conflictingAppointments = confirmedAppointments.filter(
      (apt: AppointmentWithPaymentAndPatient) => !isAppointmentCoveredBySchedules(apt.dateTime, schedules)
    );

    if (conflictingAppointments.length > 0 && !confirmCancellation) {
      res.status(HTTP_STATUS.CONFLICT).json(
        error(WORK_SCHEDULE_ERRORS.APPOINTMENTS_CONFLICT, HTTP_STATUS.CONFLICT, {
          conflictingAppointments: conflictingAppointments.map((apt: AppointmentWithPaymentAndPatient) => ({
            id: apt.id,
            dateTime: apt.dateTime,
            patient: apt.patient,
          })),
        })
      );
      return;
    }

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      for (const apt of conflictingAppointments) {
        await tx.appointment.update({
          where: { id: apt.id },
          data: { status: 'CANCELLED', cancelledById: userId },
        });

        await processRefundInTransaction(tx, apt.payment, apt.id);
      }

      await tx.workSchedule.deleteMany({ where: { physioId: userId } });

      if (schedules.length > 0) {
        await tx.workSchedule.createMany({
          data: schedules.map((s) => ({
            physioId: userId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
      }
    });

    const updated = await prisma.workSchedule.findMany({
      where: { physioId: userId },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json(
      success({
        schedules: updated,
        cancelledAppointments: conflictingAppointments.map((apt: AppointmentWithPaymentAndPatient) => apt.id),
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function getWorkSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;

    const schedules = await prisma.workSchedule.findMany({
      where: { physioId: userId },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json(success(schedules));
  } catch (err) {
    next(err);
  }
}