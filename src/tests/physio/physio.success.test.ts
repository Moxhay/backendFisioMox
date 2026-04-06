import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { HTTP_STATUS } from '../../constants/errors';

async function createPhysio(email = 'physio@test.com') {
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
  return res.body.data;
}

describe('Physio Success', () => {
  describe('GET /api/v1/physios', () => {
    it('should return empty array when no physios exist', async () => {
      const res = await request(app).get('/api/v1/physios');

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data).toEqual([]);
    });

    it('should return list of physios', async () => {
      await createPhysio('physio1@test.com');
      await createPhysio('physio2@test.com');

      const res = await request(app).get('/api/v1/physios');

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].name).toBeDefined();
      expect(res.body.data[0].pricePerSession).toBeDefined();
      expect(res.body.data[0].password).toBeUndefined();
    });
  });

  describe('GET /api/v1/physios/:id', () => {
    it('should return physio by id with work schedules', async () => {
      const physio = await createPhysio();

      const res = await request(app).get(`/api/v1/physios/${physio.id}`);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(physio.id);
      expect(res.body.data.name).toBe('Test Physio');
      expect(res.body.data.pricePerSession).toBe(5000);
      expect(res.body.data.workSchedules).toBeDefined();
      expect(res.body.data.workSchedules.length).toBe(2);
      expect(res.body.data.password).toBeUndefined();
    });
  });

  describe('PATCH /api/v1/physios/:id/price', () => {
    it('should update price as physio owner', async () => {
      const { cookie, user: physio } = await createPhysioAndGetCookie('physio-price@test.com');

      const res = await request(app)
        .patch(`/api/v1/physios/${physio.id}/price`)
        .set('Cookie', cookie)
        .send({ pricePerSession: 7500 });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.pricePerSession).toBe(7500);
    });
  });
});

async function createPhysioAndGetCookie(email = 'physio-cookie@test.com') {
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
