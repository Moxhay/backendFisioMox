import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import {
  HTTP_STATUS,
  AUTH_ERRORS,
  GENERAL_ERRORS,
  SCHEDULE_EXCEPTION_ERRORS,
} from '../../constants/errors';

vi.mock('../../lib/stripe', () => ({
  createPaymentIntent: vi.fn().mockResolvedValue({
    id: 'pi_test_123',
    status: 'succeeded',
    amount: 5000,
    client_secret: 'pi_test_123_secret',
  }),
  refundPayment: vi.fn().mockResolvedValue({}),
  constructWebhookEvent: vi.fn(),
  isPaymentSucceeded: vi.fn().mockReturnValue(true),
  requiresAction: vi.fn().mockReturnValue(false),
}));

async function createPhysioAndGetCookie(email = 'physio@test.com') {
  const res = await request(app).post('/api/v1/auth/register/physio').send({
    email,
    password: 'password123',
    name: 'Test Physio',
    pricePerSession: 5000,
    workSchedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
  });
  return { cookie: res.headers['set-cookie'], user: res.body.data };
}

async function createPatientAndGetCookie() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: 'patient@test.com',
    password: 'password123',
    name: 'Test Patient',
  });
  return { cookie: res.headers['set-cookie'], user: res.body.data };
}

function getFutureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

function getNextWeekday(dayOfWeek: number): Date {
  const today = new Date();
  const daysUntil = (dayOfWeek - today.getDay() + 7) % 7 || 7;
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + daysUntil);
  nextDay.setHours(10, 0, 0, 0);
  return nextDay;
}

describe('ScheduleException Errors', () => {
  describe('GET /api/v1/schedule-exceptions', () => {
    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/schedule-exceptions');

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail for patient role', async () => {
      const { cookie } = await createPatientAndGetCookie();

      const res = await request(app)
        .get('/api/v1/schedule-exceptions')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.FORBIDDEN.message);
    });
  });

  describe('POST /api/v1/schedule-exceptions', () => {
    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .send({ date: getFutureDate(7), isWorkingDay: false });

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail for patient role', async () => {
      const { cookie } = await createPatientAndGetCookie();

      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date: getFutureDate(7), isWorkingDay: false });

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.FORBIDDEN.message);
    });

    it('should fail with duplicate date', async () => {
      const { cookie } = await createPhysioAndGetCookie();
      const date = getFutureDate(7);

      await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date, isWorkingDay: false });

      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date, isWorkingDay: true, startTime: '10:00', endTime: '14:00' });

      expect(res.status).toBe(HTTP_STATUS.CONFLICT);
      expect(res.body.error.message).toBe(SCHEDULE_EXCEPTION_ERRORS.ALREADY_EXISTS.message);
    });

    it('should fail with invalid date format', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date: 'invalid-date', isWorkingDay: false });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail with working day but missing times', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date: getFutureDate(7), isWorkingDay: true });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail when endTime is before startTime', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({
          date: getFutureDate(7),
          isWorkingDay: true,
          startTime: '17:00',
          endTime: '09:00',
        });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should return 409 when day off conflicts with confirmed appointments', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie('physio-exc-conflict@test.com');
      const patientRes = await request(app).post('/api/v1/auth/register').send({
        email: 'patient-exc-conflict@test.com',
        password: 'password123',
        name: 'Test Patient',
      });
      const patient = patientRes.body.data;

      const appointmentDate = getNextWeekday(1);
      const dateString = appointmentDate.toISOString().split('T')[0];

      await prisma.appointment.create({
        data: {
          physioId: physio.id,
          patientId: patient.id,
          dateTime: appointmentDate,
          status: 'CONFIRMED',
        },
      });

      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', physioCookie)
        .send({ date: dateString, isWorkingDay: false });

      expect(res.status).toBe(HTTP_STATUS.CONFLICT);
      expect(res.body.error.message).toBe(SCHEDULE_EXCEPTION_ERRORS.APPOINTMENTS_CONFLICT.message);
      expect(res.body.error.details.conflictingAppointments).toBeDefined();
      expect(res.body.error.details.conflictingAppointments.length).toBe(1);
    });

    it('should cancel conflicting appointments with confirmCancellation flag', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie('physio-exc-cancel@test.com');
      const patientRes = await request(app).post('/api/v1/auth/register').send({
        email: 'patient-exc-cancel@test.com',
        password: 'password123',
        name: 'Test Patient',
      });
      const patient = patientRes.body.data;

      const appointmentDate = getNextWeekday(1);
      const dateString = appointmentDate.toISOString().split('T')[0];

      const appointment = await prisma.appointment.create({
        data: {
          physioId: physio.id,
          patientId: patient.id,
          dateTime: appointmentDate,
          status: 'CONFIRMED',
        },
      });

      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', physioCookie)
        .send({ date: dateString, isWorkingDay: false, confirmCancellation: true });

      expect(res.status).toBe(HTTP_STATUS.CREATED);
      expect(res.body.data.cancelledAppointments).toContain(appointment.id);

      const cancelledAppointment = await prisma.appointment.findUnique({
        where: { id: appointment.id },
      });
      expect(cancelledAppointment?.status).toBe('CANCELLED');
    });
  });

  describe('DELETE /api/v1/schedule-exceptions/:id', () => {
    it('should fail without authentication', async () => {
      const res = await request(app).delete(
        '/api/v1/schedule-exceptions/00000000-0000-0000-0000-000000000000'
      );

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail for patient role', async () => {
      const { cookie } = await createPatientAndGetCookie();

      const res = await request(app)
        .delete('/api/v1/schedule-exceptions/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.FORBIDDEN.message);
    });

    it('should fail with non-existent exception', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .delete('/api/v1/schedule-exceptions/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(res.body.error.message).toBe(SCHEDULE_EXCEPTION_ERRORS.NOT_FOUND.message);
    });

    it('should fail when deleting another physio exception', async () => {
      const { cookie: physio1Cookie } = await createPhysioAndGetCookie('physio1@test.com');
      const { cookie: physio2Cookie } = await createPhysioAndGetCookie('physio2@test.com');

      const createRes = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', physio1Cookie)
        .send({ date: getFutureDate(7), isWorkingDay: false });

      const res = await request(app)
        .delete(`/api/v1/schedule-exceptions/${createRes.body.data.exception.id}`)
        .set('Cookie', physio2Cookie);

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.ACCESS_DENIED.message);
    });
  });
});
