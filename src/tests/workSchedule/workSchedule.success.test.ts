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

describe('WorkSchedule Success', () => {
  describe('GET /api/v1/work-schedule', () => {
    it('should return work schedule for physio', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .get('/api/v1/work-schedule')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].dayOfWeek).toBe(1);
      expect(res.body.data[0].startTime).toBe('09:00');
      expect(res.body.data[0].endTime).toBe('17:00');
    });
  });

  describe('PUT /api/v1/work-schedule', () => {
    it('should update work schedule for physio', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const newSchedules = [
        { dayOfWeek: 1, startTime: '08:00', endTime: '16:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
        { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
      ];

      const res = await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', cookie)
        .send({ schedules: newSchedules });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.schedules.length).toBe(3);
      expect(res.body.data.schedules[0].dayOfWeek).toBe(1);
      expect(res.body.data.schedules[1].dayOfWeek).toBe(2);
      expect(res.body.data.schedules[2].dayOfWeek).toBe(3);
      expect(res.body.data.cancelledAppointments).toEqual([]);
    });

    it('should replace existing schedules', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', cookie)
        .send({
          schedules: [
            { dayOfWeek: 1, startTime: '08:00', endTime: '16:00' },
            { dayOfWeek: 2, startTime: '08:00', endTime: '16:00' },
          ],
        });

      const res = await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', cookie)
        .send({ schedules: [{ dayOfWeek: 5, startTime: '10:00', endTime: '14:00' }] });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.schedules.length).toBe(1);
      expect(res.body.data.schedules[0].dayOfWeek).toBe(5);
    });

    it('should allow clearing all schedules', async () => {
      const { cookie } = await createPhysioAndGetCookie();

      const res = await request(app)
        .put('/api/v1/work-schedule')
        .set('Cookie', cookie)
        .send({ schedules: [] });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.schedules.length).toBe(0);
    });
  });
});
