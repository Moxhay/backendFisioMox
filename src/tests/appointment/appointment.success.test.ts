import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { HTTP_STATUS } from '../../constants/errors';
import * as stripeLib from '../../lib/stripe';

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

async function createPhysioAndGetCookie() {
  const res = await request(app).post('/api/v1/auth/register/physio').send({
    email: 'physio@test.com',
    password: 'password123',
    name: 'Test Physio',
    pricePerSession: 5000,
    workSchedules: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
    ],
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
  dateTime: string,
  notes?: string
) {
  const reserveRes = await request(app)
    .post('/api/v1/appointments/reserve')
    .set('Cookie', cookie as string[])
    .send({ physioId, dateTime, notes });

  if (reserveRes.status !== 201) {
    return reserveRes;
  }

  const { appointmentId } = reserveRes.body.data;

  const payRes = await request(app)
    .post('/api/v1/appointments/pay')
    .set('Cookie', cookie as string[])
    .send({ appointmentId, paymentMethodId: 'pm_test_123' });

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { payment: true },
  });

  return {
    status: payRes.status === 200 ? 201 : payRes.status,
    body: { data: appointment },
  };
}

describe('Appointment Success', () => {
  describe('GET /api/v1/appointments/slots/week', () => {
    it('should return available slots for a week', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const startDate = getNextWeekday(1);

      const res = await request(app)
        .get('/api/v1/appointments/slots/week')
        .set('Cookie', patientCookie)
        .query({ physioId: physio.id, startDate });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data).toBe('object');
      // Should have 7 days of data
      expect(Object.keys(res.body.data).length).toBe(7);
    });

    it('should return empty slots for days physio does not work', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      // Physio only works Mon-Fri (days 1-5), get a Sunday (day 0)
      const sunday = getNextWeekday(0);

      const res = await request(app)
        .get('/api/v1/appointments/slots/week')
        .set('Cookie', patientCookie)
        .query({ physioId: physio.id, startDate: sunday });

      expect(res.status).toBe(HTTP_STATUS.OK);
      // Sunday should have empty slots
      expect(res.body.data[sunday]).toEqual([]);
    });

    it('should exclude already booked slots', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      // Book a slot
      await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .get('/api/v1/appointments/slots/week')
        .set('Cookie', patientCookie)
        .query({ physioId: physio.id, startDate: date });

      expect(res.status).toBe(HTTP_STATUS.OK);
      // The 10:00 slot should not be available
      expect(res.body.data[date]).not.toContain('10:00');
    });
  });

  describe('POST /api/v1/appointments/reserve + /pay', () => {
    it('should book an appointment as patient', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      const res = await bookAppointment(patientCookie, physio.id, dateTime, 'First appointment');

      expect(res.status).toBe(HTTP_STATUS.CREATED);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.physioId).toBe(physio.id);
      expect(res.body.data.status).toBe('CONFIRMED');
    });
  });

  describe('GET /api/v1/appointments', () => {
    it('should return appointments for patient', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Cookie', patientCookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].physio).toBeDefined();
      expect(res.body.data[0].patient).toBeDefined();
    });

    it('should return appointments for physio', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Cookie', physioCookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('PATCH /api/v1/appointments/:id/cancel', () => {
    it('should cancel appointment as patient', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      const bookRes = await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .patch(`/api/v1/appointments/${bookRes.body.data.id}/cancel`)
        .set('Cookie', patientCookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.cancelled).toBe(true);
    });

    it('should cancel appointment as physio', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      const bookRes = await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .patch(`/api/v1/appointments/${bookRes.body.data.id}/cancel`)
        .set('Cookie', physioCookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.cancelled).toBe(true);
    });

    it('should automatically refund payment when cancelling', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(2);
      const dateTime = `${date}T10:00:00`;

      const bookRes = await bookAppointment(patientCookie, physio.id, dateTime);
      const appointmentId = bookRes.body.data.id;

      const refundSpy = vi.spyOn(stripeLib, 'refundPayment');

      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/cancel`)
        .set('Cookie', patientCookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.cancelled).toBe(true);
      expect(res.body.data.refunded).toBe(true);
      expect(refundSpy).toHaveBeenCalled();

      const payment = await prisma.payment.findFirst({
        where: { appointmentId },
      });
      expect(payment?.status).toBe('REFUNDED');
    });

    it('should allow physio to cancel less than 2 hours before appointment', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie();
      const { user: patient } = await createPatientAndGetCookie();

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
        .set('Cookie', physioCookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.cancelled).toBe(true);
    });
  });

  describe('DELETE /api/v1/appointments/:id', () => {
    it('should delete a pending appointment', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(3);
      const dateTime = `${date}T11:00:00`;

      // Reserve but don't pay
      const reserveRes = await request(app)
        .post('/api/v1/appointments/reserve')
        .set('Cookie', patientCookie)
        .send({ physioId: physio.id, dateTime });

      expect(reserveRes.status).toBe(HTTP_STATUS.CREATED);
      const { appointmentId } = reserveRes.body.data;

      const res = await request(app)
        .delete(`/api/v1/appointments/${appointmentId}`)
        .set('Cookie', patientCookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.deleted).toBe(true);

      // Verify it's deleted
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });
      expect(appointment).toBeNull();
    });
  });

  describe('GET /api/v1/appointments/week', () => {
    it('should return appointments for the week as patient', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .get('/api/v1/appointments/week')
        .set('Cookie', patientCookie)
        .query({ startDate: date });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(1);
    });

    it('should return appointments for the week as physio', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .get('/api/v1/appointments/week')
        .set('Cookie', physioCookie)
        .query({ startDate: date });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(1);
    });

    it('should return empty array when no appointments in week', async () => {
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const startDate = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .get('/api/v1/appointments/week')
        .set('Cookie', patientCookie)
        .query({ startDate });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/appointments/stats', () => {
    it('should return stats for the last week', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .get('/api/v1/appointments/stats')
        .set('Cookie', physioCookie)
        .query({ period: 'week' });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(7);
      // Each entry should have date, patients, revenue
      expect(res.body.data[0]).toHaveProperty('date');
      expect(res.body.data[0]).toHaveProperty('patients');
      expect(res.body.data[0]).toHaveProperty('revenue');
    });

    it('should return stats for the current month', async () => {
      const { cookie: physioCookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .get('/api/v1/appointments/stats')
        .set('Cookie', physioCookie)
        .query({ period: 'month' });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      // Month has variable days, just check it's reasonable
      expect(res.body.data.length).toBeGreaterThanOrEqual(28);
      expect(res.body.data.length).toBeLessThanOrEqual(31);
    });
  });
});
