import type { Role, Prisma } from '../generated/prisma/client';

export function buildUserWhereClause(role: Role, userId: string) {
  return role === 'PATIENT' ? { patientId: userId } : { physioId: userId };
}

export function buildAppointmentFilter(
  role: Role,
  userId: string,
  month?: string
): Prisma.AppointmentWhereInput {
  const filter: Prisma.AppointmentWhereInput = buildUserWhereClause(role, userId);

  if (month) {
    const [year, monthNum] = month.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
    filter.dateTime = { gte: startOfMonth, lte: endOfMonth };
  }

  return filter;
}

export const appointmentInclude = {
  simpleList: {
    physio: { select: { id: true, name: true, email: true } },
    patient: { select: { id: true, name: true, email: true } },
    payment: { select: { id: true, amount: true, status: true } },
  },
  withPaymentDetails: {
    payment: { select: { amount: true, status: true } },
  },
} as const;

export const paymentInclude = {
  withAppointment: {
    appointment: {
      select: {
        id: true,
        dateTime: true,
        status: true,
        physio: { select: { id: true, name: true } },
        patient: { select: { id: true, name: true } },
      },
    },
  },
} as const;
