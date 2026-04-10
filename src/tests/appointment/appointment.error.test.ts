import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import {
  HTTP_STATUS,
  AUTH_ERRORS,
  GENERAL_ERRORS,
  PHYSIO_ERRORS,
  APPOINTMENT_ERRORS,
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

async function createPatientAndGetCookie(email = 'patient@test.com') {
  const res = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'password123',
    name: 'Test Patient',
  });
  return { cookie: res.headers['set-cookie'], user: res.body.data };
}

function getNextWeekday(dayOfWeek: number): string {
  const today = new Date();
  const daysUntil = (dayOfWeek - today.getDay() + 7) % 7 || 7;
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + daysUntil);
  return nextDay.toISOString().split('T')[0];
}

async function bookAppointment(
  cookie: string | string[] | undefined,
  physioId: string,
  dateTime: string
) {
  const reserveRes = await request(app)
    .post('/api/v1/appointments/reserve')
    .set('Cookie', cookie as string[])
    .send({ physioId, dateTime });

  if (reserveRes.status !== 201) {
    return reserveRes;
  }

  const { appointmentId } = reserveRes.body.data;

  await request(app)
    .post('/api/v1/appointments/pay')
    .set('Cookie', cookie as string[])
    .send({ appointmentId, paymentMethodId: 'pm_test_123' });

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  return { body: { data: appointment } };
}

describe('Appointment Errors', () => {
  describe('POST /api/v1/appointments/reserve', () => {
    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/reserve')
        .send({
          physioId: 'some-id',
          dateTime: '2025-01-01T10:00:00',
        });

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail when booking as physio', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie();
      const date = getNextWeekday(1);

      const res = await request(app)
        .post('/api/v1/appointments/reserve')
        .set('Cookie', physioCookie)
        .send({
          physioId: physio.id,
          dateTime: `${date}T10:00:00`,
        });

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.FORBIDDEN.message);
    });

    it('should fail with non-existent physio', async () => {
      const { cookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);

      const res = await request(app)
        .post('/api/v1/appointments/reserve')
        .set('Cookie', cookie)
        .send({
          physioId: '00000000-0000-0000-0000-000000000000',
          dateTime: `${date}T10:00:00`,
        });

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(res.body.error.message).toBe(PHYSIO_ERRORS.NOT_FOUND.message);
    });

    it('should fail when slot is already booked', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patient1Cookie } = await createPatientAndGetCookie('patient1@test.com');
      const { cookie: patient2Cookie } = await createPatientAndGetCookie('patient2@test.com');
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      await bookAppointment(patient1Cookie, physio.id, dateTime);

      const res = await request(app)
        .post('/api/v1/appointments/reserve')
        .set('Cookie', patient2Cookie)
        .send({ physioId: physio.id, dateTime });

      expect(res.status).toBe(HTTP_STATUS.CONFLICT);
      expect(res.body.error.message).toBe(APPOINTMENT_ERRORS.SLOT_ALREADY_BOOKED.message);
    });
  });

  describe('GET /api/v1/appointments', () => {
    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/appointments');

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });
  });

  describe('PATCH /api/v1/appointments/:id/cancel', () => {
    it('should fail without authentication', async () => {
      const res = await request(app).patch('/api/v1/appointments/some-id/cancel');

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail with non-existent appointment', async () => {
      const { cookie } = await createPatientAndGetCookie();

      const res = await request(app)
        .patch('/api/v1/appointments/00000000-0000-0000-0000-000000000000/cancel')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(res.body.error.message).toBe(APPOINTMENT_ERRORS.NOT_FOUND.message);
    });

    it('should fail when cancelling another users appointment', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie('patient1@test.com');
      const { cookie: otherPatientCookie } = await createPatientAndGetCookie('patient2@test.com');
      const date = getNextWeekday(1);

      const bookRes = await bookAppointment(patientCookie, physio.id, `${date}T10:00:00`);

      const res = await request(app)
        .patch(`/api/v1/appointments/${bookRes.body.data.id}/cancel`)
        .set('Cookie', otherPatientCookie);

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.ACCESS_DENIED.message);
    });

    it('should fail when appointment is already cancelled', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);

      const bookRes = await bookAppointment(patientCookie, physio.id, `${date}T10:00:00`);

      await request(app)
        .patch(`/api/v1/appointments/${bookRes.body.data.id}/cancel`)
        .set('Cookie', patientCookie);

      const res = await request(app)
        .patch(`/api/v1/appointments/${bookRes.body.data.id}/cancel`)
        .set('Cookie', patientCookie);

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.error.message).toBe(APPOINTMENT_ERRORS.ALREADY_CANCELLED.message);
    });

    it('should fail when cancelling less than 2 hours before appointment', async () => {
      const { user: physio } = await createPhysioAndGetCookie('physio-late@test.com');
      const { cookie: patientCookie, user: patient } = await createPatientAndGetCookie('patient-late@test.com');

      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

      const appointment = await prisma.appointment.create({
        data: {
          physioId: physio.id,
          patientId: patient.id,
          dateTime: oneHourFromNow,
          status: 'CONFIRMED',
        },
      });

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointment.id}/cancel`)
        .set('Cookie', patientCookie);

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.error.message).toBe(APPOINTMENT_ERRORS.TOO_LATE_TO_CANCEL.message);
    });
  });

  describe('GET /api/v1/appointments/slots/week', () => {
    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/appointments/slots/week')
        .query({ physioId: '00000000-0000-0000-0000-000000000000', startDate: '2025-01-01' });

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail with non-existent physio', async () => {
      const { cookie } = await createPatientAndGetCookie('patient-slots@test.com');

      const res = await request(app)
        .get('/api/v1/appointments/slots/week')
        .set('Cookie', cookie)
        .query({ physioId: '00000000-0000-0000-0000-000000000000', startDate: '2025-01-01' });

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it('should fail without required query params', async () => {
      const { cookie } = await createPatientAndGetCookie('patient-noparam@test.com');

      const res = await request(app)
        .get('/api/v1/appointments/slots/week')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
  });

  describe('DELETE /api/v1/appointments/:id', () => {
    it('should fail without authentication', async () => {
      const res = await request(app).delete('/api/v1/appointments/some-id');

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail with non-existent appointment', async () => {
      const { cookie } = await createPatientAndGetCookie('patient-delete@test.com');

      const res = await request(app)
        .delete('/api/v1/appointments/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it('should fail when deleting another users appointment', async () => {
      const { user: physio } = await createPhysioAndGetCookie('physio-delete@test.com');
      const { cookie: patient1Cookie } = await createPatientAndGetCookie('patient1-delete@test.com');
      const { cookie: patient2Cookie } = await createPatientAndGetCookie('patient2-delete@test.com');
      const date = getNextWeekday(1);

      // Patient 1 reserves
      const reserveRes = await request(app)
        .post('/api/v1/appointments/reserve')
        .set('Cookie', patient1Cookie)
        .send({ physioId: physio.id, dateTime: `${date}T11:00:00` });

      const { appointmentId } = reserveRes.body.data;

      // Patient 2 tries to delete
      const res = await request(app)
        .delete(`/api/v1/appointments/${appointmentId}`)
        .set('Cookie', patient2Cookie);

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it('should fail when deleting confirmed appointment', async () => {
      const { user: physio } = await createPhysioAndGetCookie('physio-confirmed@test.com');
      const { cookie: patientCookie } = await createPatientAndGetCookie('patient-confirmed@test.com');
      const date = getNextWeekday(1);

      const bookRes = await bookAppointment(patientCookie, physio.id, `${date}T12:00:00`);

      const res = await request(app)
        .delete(`/api/v1/appointments/${bookRes.body.data.id}`)
        .set('Cookie', patientCookie);

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
  });

  describe('GET /api/v1/appointments/week', () => {
    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/appointments/week')
        .query({ startDate: '2025-01-01' });

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail without startDate', async () => {
      const { cookie } = await createPatientAndGetCookie('patient-week@test.com');

      const res = await request(app)
        .get('/api/v1/appointments/week')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
  });

  describe('GET /api/v1/appointments/stats', () => {
    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/appointments/stats');

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });
  });

  describe('POST /api/v1/appointments/pay', () => {
    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/pay')
        .send({ appointmentId: 'some-id', paymentMethodId: 'pm_test' });

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail with non-existent appointment', async () => {
      const { cookie } = await createPatientAndGetCookie('patient-pay@test.com');

      const res = await request(app)
        .post('/api/v1/appointments/pay')
        .set('Cookie', cookie)
        .send({ appointmentId: '00000000-0000-0000-0000-000000000000', paymentMethodId: 'pm_test' });

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it('should fail when paying for another users appointment', async () => {
      const { user: physio } = await createPhysioAndGetCookie('physio-pay@test.com');
      const { cookie: patient1Cookie } = await createPatientAndGetCookie('patient1-pay@test.com');
      const { cookie: patient2Cookie } = await createPatientAndGetCookie('patient2-pay@test.com');
      const date = getNextWeekday(1);

      const reserveRes = await request(app)
        .post('/api/v1/appointments/reserve')
        .set('Cookie', patient1Cookie)
        .send({ physioId: physio.id, dateTime: `${date}T14:00:00` });

      const { appointmentId } = reserveRes.body.data;

      const res = await request(app)
        .post('/api/v1/appointments/pay')
        .set('Cookie', patient2Cookie)
        .send({ appointmentId, paymentMethodId: 'pm_test' });

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    });
  });
});
