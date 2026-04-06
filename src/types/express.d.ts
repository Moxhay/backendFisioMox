import {
  User,
  WorkSchedule,
  ScheduleException,
  Appointment,
  Prisma,
} from '../generated/prisma/client';
import Stripe from 'stripe';

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: {
    physio: { select: { id: true; name: true; email: true; pricePerSession: true } };
    patient: { select: { id: true; name: true; email: true } };
    payment: { select: { id: true; amount: true; status: true; stripePaymentIntentId: true } };
  };
}>;

type PhysioWithSchedules = {
  id: string;
  name: string;
  pricePerSession: number | null;
  workSchedules: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
};

declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'password'>;
      sessionId?: string;
      physioSchedule?: {
        physio: { id: string; pricePerSession: number | null };
        workSchedule: WorkSchedule;
        exception: ScheduleException | null;
        targetDate: Date;
      };
      appointment?: AppointmentWithRelations;
      stripeEvent?: Stripe.Event;
      stripeAppointment?: Appointment;
      physio?: PhysioWithSchedules;
      scheduleException?: ScheduleException;
    }
  }
}
