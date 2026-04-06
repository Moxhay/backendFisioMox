import { Router } from 'express';
import {
  getWeekSlots,
  reserveAppointment,
  processPayment,
  deleteAppointment,
  getMyAppointments,
  getMyWeekAppointments,
  cancelAppointment,
  getAppointmentStats,
  getCompareStats,
} from '../controllers/appointment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { appointmentLimiter } from '../middleware/rateLimiter.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  validateGetWeekSlots,
  validateReserveAppointment,
  validateProcessPayment,
  validateAppointmentId,
  validateGetMyAppointments,
  validateGetMyWeekAppointments,
  validateGetStats,
  validateGetCompareStats,
} from '../middleware/appointment.validation';
import {
  validatePhysioExists,
  validatePhysioAvailability,
  validateSlotAvailable,
} from '../middleware/physioAvailability.middleware';
import {
  validateAppointmentAccess,
  validatePendingAppointmentOwnership,
  validateAppointmentNotExpired,
  validateAppointmentNotCancelled,
  validateCancellationTime,
} from '../middleware/appointmentAccess.middleware';

export const appointmentRouter = Router();

appointmentRouter.get(
  '/slots/week',
  appointmentLimiter,
  authenticate,
  validateGetWeekSlots,
  validatePhysioExists,
  getWeekSlots
);

appointmentRouter.post(
  '/reserve',
  appointmentLimiter,
  authenticate,
  requireRole('PATIENT'),
  validateReserveAppointment,
  validatePhysioAvailability,
  validateSlotAvailable,
  reserveAppointment
);

appointmentRouter.post(
  '/pay',
  appointmentLimiter,
  authenticate,
  requireRole('PATIENT'),
  validateProcessPayment,
  validatePendingAppointmentOwnership,
  validateAppointmentNotExpired,
  processPayment
);

appointmentRouter.delete(
  '/:id',
  appointmentLimiter,
  authenticate,
  validateAppointmentId,
  validatePendingAppointmentOwnership,
  deleteAppointment
);

appointmentRouter.get('/', appointmentLimiter, authenticate, validateGetMyAppointments, getMyAppointments);

appointmentRouter.get('/week', appointmentLimiter, authenticate, validateGetMyWeekAppointments, getMyWeekAppointments);

appointmentRouter.get('/stats', appointmentLimiter, authenticate, validateGetStats, getAppointmentStats);

appointmentRouter.get('/compare-stats', appointmentLimiter, authenticate, validateGetCompareStats, getCompareStats);

appointmentRouter.patch(
  '/:id/cancel',
  appointmentLimiter,
  authenticate,
  validateAppointmentId,
  validateAppointmentAccess,
  validateAppointmentNotCancelled,
  validateCancellationTime,
  cancelAppointment
);
