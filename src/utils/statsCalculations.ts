import type { WorkSchedule, ScheduleException } from '../generated/prisma/client';
import { generateTimeSlots } from './time';
import { formatDateLocal } from './dateRanges';
import { SLOT_DURATION_MINUTES } from '../constants/appointments';

interface AppointmentWithPayment {
  dateTime: Date;
  payment?: { amount: number; status: string } | null;
}

interface DayStats {
  patients: number;
  revenue: number;
}

export interface MonthTotals {
  totalPatients: number;
  totalRevenue: number;
}

export function calculateTotals(appointments: AppointmentWithPayment[]): MonthTotals {
  let totalPatients = 0;
  let totalRevenue = 0;

  for (const apt of appointments) {
    totalPatients += 1;
    if (apt.payment?.status === 'SUCCEEDED') {
      totalRevenue += apt.payment.amount / 100;
    }
  }

  return { totalPatients, totalRevenue };
}

export function calculateSlotsForMonth(
  monthStart: Date,
  monthEnd: Date,
  workSchedules: WorkSchedule[],
  exceptions: ScheduleException[]
): number {
  const scheduleByDay = workSchedules.reduce(
    (acc, ws) => {
      acc[ws.dayOfWeek] = ws;
      return acc;
    },
    {} as Record<number, WorkSchedule>
  );

  const exceptionByDate = exceptions.reduce(
    (acc, ex) => {
      acc[formatDateLocal(ex.date)] = ex;
      return acc;
    },
    {} as Record<string, ScheduleException>
  );

  let totalSlots = 0;
  const current = new Date(monthStart);

  while (current <= monthEnd) {
    const dateStr = formatDateLocal(current);
    const dayOfWeek = current.getDay();
    const schedule = scheduleByDay[dayOfWeek];
    const exception = exceptionByDate[dateStr];

    if (schedule && (!exception || exception.isWorkingDay)) {
      const startTime = exception?.startTime || schedule.startTime;
      const endTime = exception?.endTime || schedule.endTime;
      const slots = generateTimeSlots(startTime, endTime, SLOT_DURATION_MINUTES);
      totalSlots += slots.length;
    }

    current.setDate(current.getDate() + 1);
  }

  return totalSlots;
}

export function groupStatsByDay(
  appointments: AppointmentWithPayment[],
  start: Date,
  days: number
): Array<{ date: string; patients: number; revenue: number }> {
  const statsByDay: Record<string, DayStats> = {};

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateStr = formatDateLocal(date);
    statsByDay[dateStr] = { patients: 0, revenue: 0 };
  }

  // Populate with data
  for (const apt of appointments) {
    const dateStr = formatDateLocal(apt.dateTime);
    if (statsByDay[dateStr]) {
      statsByDay[dateStr].patients += 1;
      if (apt.payment?.status === 'SUCCEEDED') {
        statsByDay[dateStr].revenue += apt.payment.amount / 100;
      }
    }
  }

  // Convert to sorted array
  return Object.entries(statsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));
}
