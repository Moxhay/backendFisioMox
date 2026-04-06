import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { WorkSchedule, ScheduleException, Appointment } from '../generated/prisma/client';
import { createPaymentIntent, isPaymentSucceeded, requiresAction } from '../lib/stripe';
import { generateTimeSlots } from '../utils/time';
import { success, error } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import {
  getCurrentMonthRange,
  getPreviousMonthRange,
  getCurrentWeekRange,
  formatMonthLocal,
  getStartOfDay,
} from '../utils/dateRanges';
import { calculateTotals, calculateSlotsForMonth, groupStatsByDay } from '../utils/statsCalculations';
import { buildUserWhereClause, appointmentInclude } from '../utils/queryBuilders';
import { processRefundIfNeeded } from '../utils/refund';
import { HTTP_STATUS, PAYMENT_ERRORS } from '../constants/errors';
import { SLOT_DURATION_MINUTES, RESERVATION_EXPIRY_MINUTES } from '../constants/appointments';

export async function getWeekSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const { physioId, startDate } = req.query as { physioId: string; startDate: string };

    const start = new Date(startDate);
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }

    const endDate = dates[6];

    const [workSchedules, exceptions, bookedAppointments] = await Promise.all([
      prisma.workSchedule.findMany({ where: { physioId } }),
      prisma.scheduleException.findMany({
        where: { physioId, date: { gte: start, lte: endDate } },
      }),
      prisma.appointment.findMany({
        where: {
          physioId,
          dateTime: { gte: start, lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000) },
          OR: [{ status: 'CONFIRMED' }, { status: 'PENDING', expiresAt: { gt: new Date() } }],
        },
      }),
    ]);

    const scheduleByDay = workSchedules.reduce(
      (acc: Record<number, WorkSchedule>, ws: WorkSchedule) => {
        acc[ws.dayOfWeek] = ws;
        return acc;
      },
      {} as Record<number, WorkSchedule>
    );

    const exceptionByDate = exceptions.reduce(
      (acc: Record<string, ScheduleException>, ex: ScheduleException) => {
        const dateStr = ex.date.toISOString().split('T')[0];
        acc[dateStr] = ex;
        return acc;
      },
      {} as Record<string, ScheduleException>
    );

    const bookedByDate = bookedAppointments.reduce(
      (acc: Record<string, Set<number>>, apt: Appointment) => {
        const dateStr = apt.dateTime.toISOString().split('T')[0];
        if (!acc[dateStr]) acc[dateStr] = new Set<number>();
        acc[dateStr].add(apt.dateTime.getTime());
        return acc;
      },
      {} as Record<string, Set<number>>
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: Record<string, string[]> = {};

    for (const date of dates) {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const schedule = scheduleByDay[dayOfWeek];
      const exception = exceptionByDate[dateStr];

      if (date < today || !schedule || (exception && !exception.isWorkingDay)) {
        result[dateStr] = [];
        continue;
      }

      const startTime = exception?.startTime || schedule.startTime;
      const endTime = exception?.endTime || schedule.endTime;
      const allSlots = generateTimeSlots(startTime, endTime, SLOT_DURATION_MINUTES);
      const bookedTimes = bookedByDate[dateStr] || new Set();

      result[dateStr] = allSlots.filter((slot) => {
        const slotTime = new Date(`${dateStr}T${slot}:00`).getTime();
        return !bookedTimes.has(slotTime);
      });
    }

    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function reserveAppointment(req: Request, res: Response, next: NextFunction) {
  const patientId = req.user!.id;
  const { physioId, dateTime, notes } = req.body;

  try {
    const expiresAt = new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000);

    const appointment = await prisma.appointment.create({
      data: {
        physioId,
        patientId,
        dateTime: new Date(dateTime),
        notes: notes || null,
        status: 'PENDING',
        expiresAt,
      },
    });

    res.status(201).json(success({ appointmentId: appointment.id, expiresAt }));
  } catch (err) {
    next(err);
  }
}

export async function processPayment(req: Request, res: Response, next: NextFunction) {
  const { paymentMethodId } = req.body;
  const appointment = req.appointment!;

  try {
    const paymentIntent = await createPaymentIntent({
      amount: appointment.physio.pricePerSession!,
      paymentMethodId,
      appointmentId: appointment.id,
    });

    await prisma.payment.create({
      data: {
        appointmentId: appointment.id,
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        status: 'PENDING',
      },
    });

    if (isPaymentSucceeded(paymentIntent.status)) {
      await prisma.$transaction([
        prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: 'CONFIRMED', expiresAt: null },
        }),
        prisma.payment.update({
          where: { appointmentId: appointment.id },
          data: { status: 'SUCCEEDED' },
        }),
      ]);

      res.json(success({ status: 'succeeded' }));
      return;
    }

    if (requiresAction(paymentIntent.status)) {
      res.json(
        success({
          status: 'requires_action',
          clientSecret: paymentIntent.client_secret,
        })
      );
      return;
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: { appointmentId: appointment.id },
        data: { status: 'FAILED' },
      }),
      prisma.appointment.delete({ where: { id: appointment.id } }),
    ]);

    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(error(PAYMENT_ERRORS.PAYMENT_FAILED, HTTP_STATUS.BAD_REQUEST));
  } catch (err) {
    next(err);
  }
}

export async function deleteAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const appointment = req.appointment!;

    await prisma.appointment.delete({ where: { id: appointment.id } });

    res.json(success({ deleted: true }));
  } catch (err) {
    next(err);
  }
}

export async function getMyAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: userId, role } = req.user!;
    const { page } = req.query as { page?: string };

    const pagination = parsePagination(page);
    const where = buildUserWhereClause(role, userId);

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: appointmentInclude.simpleList,
        orderBy: { dateTime: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
      }),
      prisma.appointment.count({ where }),
    ]);

    res.json(success(appointments, buildPaginationMeta(pagination, total)));
  } catch (err) {
    next(err);
  }
}

export async function getMyWeekAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: userId, role } = req.user!;
    const { startDate } = req.query as { startDate: string };

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const where = {
      ...buildUserWhereClause(role, userId),
      dateTime: { gte: start, lt: end },
      status: { not: 'CANCELLED' as const },
    };

    const appointments = await prisma.appointment.findMany({
      where,
      include: appointmentInclude.simpleList,
      orderBy: { dateTime: 'asc' },
    });

    res.json(success(appointments));
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const appointment = req.appointment!;

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED', cancelledById: req.user!.id },
    });

    const refunded = await processRefundIfNeeded(appointment.payment, appointment.id);

    res.json(success({ cancelled: true, refunded }));
  } catch (err) {
    next(err);
  }
}

export async function getAppointmentStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: userId, role } = req.user!;
    const { period } = req.query as { period?: 'week' | 'month' };

    const range = period === 'month' ? getCurrentMonthRange() : getCurrentWeekRange();

    const where = {
      ...buildUserWhereClause(role, userId),
      dateTime: { gte: range.start, lte: range.end },
      status: 'CONFIRMED' as const,
    };

    const appointments = await prisma.appointment.findMany({
      where,
      include: appointmentInclude.withPaymentDetails,
    });

    const stats = groupStatsByDay(appointments, range.start, range.days);

    res.json(success(stats));
  } catch (err) {
    next(err);
  }
}

export async function getCompareStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: userId, role } = req.user!;

    const currentMonth = getCurrentMonthRange();
    const previousMonth = getPreviousMonthRange();

    const userWhere = buildUserWhereClause(role, userId);

    const [currentAppointments, previousAppointments, currentCancelled, previousCancelled] =
      await Promise.all([
        prisma.appointment.findMany({
          where: {
            ...userWhere,
            dateTime: { gte: currentMonth.start, lte: currentMonth.end },
            status: 'CONFIRMED',
          },
          include: appointmentInclude.withPaymentDetails,
        }),
        prisma.appointment.findMany({
          where: {
            ...userWhere,
            dateTime: { gte: previousMonth.start, lte: previousMonth.end },
            status: 'CONFIRMED',
          },
          include: appointmentInclude.withPaymentDetails,
        }),
        prisma.appointment.count({
          where: {
            ...userWhere,
            dateTime: { gte: currentMonth.start, lte: currentMonth.end },
            status: 'CANCELLED',
          },
        }),
        prisma.appointment.count({
          where: {
            ...userWhere,
            dateTime: { gte: previousMonth.start, lte: previousMonth.end },
            status: 'CANCELLED',
          },
        }),
      ]);

    let currentTotalSlots = 0;
    let prevTotalSlots = 0;

    if (role === 'PHYSIO') {
      const [workSchedules, currentExceptions, prevExceptions] = await Promise.all([
        prisma.workSchedule.findMany({ where: { physioId: userId } }),
        prisma.scheduleException.findMany({
          where: { physioId: userId, date: { gte: currentMonth.start, lte: currentMonth.end } },
        }),
        prisma.scheduleException.findMany({
          where: { physioId: userId, date: { gte: previousMonth.start, lte: previousMonth.end } },
        }),
      ]);

      currentTotalSlots = calculateSlotsForMonth(
        currentMonth.start,
        currentMonth.end,
        workSchedules,
        currentExceptions
      );
      prevTotalSlots = calculateSlotsForMonth(
        previousMonth.start,
        previousMonth.end,
        workSchedules,
        prevExceptions
      );
    }

    const currentTotals = calculateTotals(currentAppointments);
    const previousTotals = calculateTotals(previousAppointments);

    res.json(
      success({
        currentMonth: {
          month: formatMonthLocal(currentMonth.start),
          totalSlots: currentTotalSlots,
          bookedSlots: currentAppointments.length,
          cancelledAppointments: currentCancelled,
          ...currentTotals,
        },
        previousMonth: {
          month: formatMonthLocal(previousMonth.start),
          totalSlots: prevTotalSlots,
          bookedSlots: previousAppointments.length,
          cancelledAppointments: previousCancelled,
          ...previousTotals,
        },
      })
    );
  } catch (err) {
    next(err);
  }
}
