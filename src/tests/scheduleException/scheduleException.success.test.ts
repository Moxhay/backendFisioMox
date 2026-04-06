import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { HTTP_STATUS } from '../../constants/errors';

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

function getFutureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

describe('ScheduleException Success', () => {
  describe('GET /api/v1/schedule-exceptions', () => {
    it('should return empty array when no exceptions exist', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .get('/api/v1/schedule-exceptions')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data).toEqual([]);
    });

    it('should return list of exceptions', async () => {
      const { cookie } = await createPhysioAndGetCookie();
      const date1 = getFutureDate(7);
      const date2 = getFutureDate(14);

      await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date: date1, isWorkingDay: false });

      await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date: date2, isWorkingDay: true, startTime: '10:00', endTime: '14:00' });

      const res = await request(app)
        .get('/api/v1/schedule-exceptions')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('POST /api/v1/schedule-exceptions', () => {
    it('should create a day off exception', async () => {
      const { cookie } = await createPhysioAndGetCookie();
      const date = getFutureDate(7);

      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date, isWorkingDay: false });

      expect(res.status).toBe(HTTP_STATUS.CREATED);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.exception.isWorkingDay).toBe(false);
      expect(res.body.data.exception.startTime).toBeNull();
      expect(res.body.data.exception.endTime).toBeNull();
      expect(res.body.data.cancelledAppointments).toEqual([]);
    });

    it('should create a modified hours exception', async () => {
      const { cookie } = await createPhysioAndGetCookie();
      const date = getFutureDate(7);

      const res = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date, isWorkingDay: true, startTime: '10:00', endTime: '14:00' });

      expect(res.status).toBe(HTTP_STATUS.CREATED);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.exception.isWorkingDay).toBe(true);
      expect(res.body.data.exception.startTime).toBe('10:00');
      expect(res.body.data.exception.endTime).toBe('14:00');
      expect(res.body.data.cancelledAppointments).toEqual([]);
    });
  });

  describe('DELETE /api/v1/schedule-exceptions/:id', () => {
    it('should delete an exception', async () => {
      const { cookie } = await createPhysioAndGetCookie();
      const date = getFutureDate(7);

      const createRes = await request(app)
        .post('/api/v1/schedule-exceptions')
        .set('Cookie', cookie)
        .send({ date, isWorkingDay: false });

      const res = await request(app)
        .delete(`/api/v1/schedule-exceptions/${createRes.body.data.exception.id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.deleted).toBe(true);

      const listRes = await request(app)
        .get('/api/v1/schedule-exceptions')
        .set('Cookie', cookie);

      expect(listRes.body.data.length).toBe(0);
    });
  });
});
