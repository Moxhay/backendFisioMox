import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { HTTP_STATUS, PHYSIO_ERRORS, AUTH_ERRORS, GENERAL_ERRORS } from '../../constants/errors';

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

describe('Physio Errors', () => {
  describe('GET /api/v1/physios/:id', () => {
    it('should fail with non-existent physio', async () => {
      const res = await request(app).get(
        '/api/v1/physios/00000000-0000-0000-0000-000000000000'
      );

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(res.body.error.message).toBe(PHYSIO_ERRORS.NOT_FOUND.message);
    });

    it('should fail with invalid UUID', async () => {
      const res = await request(app).get('/api/v1/physios/invalid-id');

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(res.body.error.message).toBe(PHYSIO_ERRORS.NOT_FOUND.message);
    });
  });

  describe('PATCH /api/v1/physios/:id/price', () => {
    it('should fail without authentication', async () => {
      const res = await request(app)
        .patch('/api/v1/physios/00000000-0000-0000-0000-000000000000/price')
        .send({ pricePerSession: 5000 });

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });

    it('should fail when updating another physio price', async () => {
      const { user: physio1 } = await createPhysioAndGetCookie('physio1@test.com');
      const { cookie: physio2Cookie } = await createPhysioAndGetCookie('physio2@test.com');

      const res = await request(app)
        .patch(`/api/v1/physios/${physio1.id}/price`)
        .set('Cookie', physio2Cookie)
        .send({ pricePerSession: 7500 });

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.FORBIDDEN.message);
    });

    it('should fail when patient tries to update price', async () => {
      const { user: physio } = await createPhysioAndGetCookie('physio-patient@test.com');
      const { cookie: patientCookie } = await createPatientAndGetCookie();

      const res = await request(app)
        .patch(`/api/v1/physios/${physio.id}/price`)
        .set('Cookie', patientCookie)
        .send({ pricePerSession: 7500 });

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.error.message).toBe(GENERAL_ERRORS.FORBIDDEN.message);
    });

    it('should fail with invalid price', async () => {
      const { cookie, user: physio } = await createPhysioAndGetCookie('physio-invalid@test.com');

      const res = await request(app)
        .patch(`/api/v1/physios/${physio.id}/price`)
        .set('Cookie', cookie)
        .send({ pricePerSession: 0 });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail with negative price', async () => {
      const { cookie, user: physio } = await createPhysioAndGetCookie('physio-negative@test.com');

      const res = await request(app)
        .patch(`/api/v1/physios/${physio.id}/price`)
        .set('Cookie', cookie)
        .send({ pricePerSession: -100 });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
  });
});
