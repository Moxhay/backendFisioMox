import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { HTTP_STATUS, AUTH_ERRORS, GENERAL_ERRORS, WORK_SCHEDULE_ERRORS } from '../../constants/errors';

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
    workSchedules: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
    ],
  });
  return { cookie: res.headers['set-cookie'], user: res.body.data };
}

async function createPatientAndGetCookie(email = 'patient@test.com') {
  const res = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'password123',
    name: 'Test Patient',
  });
  return { cookie: res.headers['set-cookie'], user: res.body.data };
}

function getNextWeekday(dayOfWeek: number): Date {
  const today = new Date();
  const daysUntil = (dayOfWeek - today.getDay() + 7) % 7 || 7;
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + daysUntil);
  nextDay.setHours(10, 0, 0, 0);
  return nextDay;
}

describe('WorkSchedule Errors', () => {
  describe('GET /api/v1/work-schedule', () => {
    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/work-schedule');

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED);
    });

    it('should fail for patient role', async () => {
      const { cookie } = await createPatientAndGetCookie();

      const res = await request(app)
        .get('/api/v1/work-schedule')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.FORBIDDEN);
    });
  });

  describe('PUT /api/v1/work-schedule', () => {
    it('should fail without authentication', async () => {
      const res = await request(app)
        .put('/api/v1/work-schedule')
        .send({ schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] });

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED);
    });

    it('should fail for patient role', async () => {
      const { cookie } = await createPatientAndGetCookie();

      const res = await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', cookie)
        .send({ schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }] });

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.FORBIDDEN);
    });

    it('should fail with invalid dayOfWeek', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', cookie)
        .send({ schedules: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' }] });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail with invalid time format', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', cookie)
        .send({ schedules: [{ dayOfWeek: 1, startTime: '9:00', endTime: '17:00' }] });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail when endTime is before startTime', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', cookie)
        .send({ schedules: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00' }] });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should return 409 when schedule change conflicts with confirmed appointments', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie('physio-conflict@test.com');
      const { user: patient } = await createPatientAndGetCookie('patient-conflict@test.com');

      const appointmentDate = getNextWeekday(1);

      await prisma.appointment.create({
        data: {
          physioId: physio.id,
          patientId: patient.id,
          dateTime: appointmentDate,
          status: 'CONFIRMED',
        },
      });

      const res = await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', physioCookie)
        .send({ schedules: [{ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }] });

      expect(res.status).toBe(HTTP_STATUS.CONFLICT);
      expect(res.body.error.message).toBe(WORK_SCHEDULE_ERRORS.APPOINTMENTS_CONFLICT);
      expect(res.body.error.details.conflictingAppointments).toBeDefined();
      expect(res.body.error.details.conflictingAppointments.length).toBe(1);
    });

    it('should cancel conflicting appointments with confirmCancellation flag', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie('physio-cancel@test.com');
      const { user: patient } = await createPatientAndGetCookie('patient-cancel@test.com');

      const appointmentDate = getNextWeekday(1);

      const appointment = await prisma.appointment.create({
        data: {
          physioId: physio.id,
          patientId: patient.id,
          dateTime: appointmentDate,
          status: 'CONFIRMED',
        },
      });

      const res = await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', physioCookie)
        .send({
          schedules: [{ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }],
          confirmCancellation: true,
        });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.cancelledAppointments).toContain(appointment.id);

      const cancelledAppointment = await prisma.appointment.findUnique({
        where: { id: appointment.id },
      });
      expect(cancelledAppointment?.status).toBe('CANCELLED');
    });

  });
});
