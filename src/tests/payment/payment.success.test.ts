import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { HTTP_STATUS } from '../../constants/errors';

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

function getNextWeekday(dayOfWeek: number): string {
  const today = new Date();
  const daysUntil = (dayOfWeek - today.getDay() + 7) % 7 || 7;
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + daysUntil);
  return nextDay.toISOString().split('T')[0];
}

async function bookAppointment(cookie: string | string[] | undefined, physioId: string, dateTime: string) {
  const reserveRes = await request(app)
    .post('/api/v1/appointments/reserve')
    .set('Cookie', cookie as string[])
    .send({ physioId, dateTime });

  if (reserveRes.status !== 201) return reserveRes;

  const { appointmentId } = reserveRes.body.data;

  await request(app)
    .post('/api/v1/appointments/pay')
    .set('Cookie', cookie as string[])
    .send({ appointmentId, paymentMethodId: 'pm_test_123' });

  return reserveRes;
}

describe('Payment Success', () => {
  describe('GET /api/v1/payments', () => {
    it('should return empty array when no payments exist', async () => {
      const { cookie } = await createPatientAndGetCookie();

      const res = await request(app)
        .get('/api/v1/payments')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data).toEqual([]);
    });

    it('should return payments for patient', async () => {
      const { user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .get('/api/v1/payments')
        .set('Cookie', patientCookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].amount).toBe(5000);
      expect(res.body.data[0].appointment).toBeDefined();
    });

    it('should return payments for physio', async () => {
      const { cookie: physioCookie, user: physio } = await createPhysioAndGetCookie();
      const { cookie: patientCookie } = await createPatientAndGetCookie();
      const date = getNextWeekday(1);
      const dateTime = `${date}T10:00:00`;

      await bookAppointment(patientCookie, physio.id, dateTime);

      const res = await request(app)
        .get('/api/v1/payments')
        .set('Cookie', physioCookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.length).toBe(1);
    });
  });
});
