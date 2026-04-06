import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { HTTP_STATUS } from '../../constants/errors';

describe('Auth Success', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new patient', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'patient@test.com',
        password: 'password123',
        name: 'Test Patient',
      });

      expect(res.status).toBe(HTTP_STATUS.CREATED);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe('patient@test.com');
      expect(res.body.data.name).toBe('Test Patient');
      expect(res.body.data.role).toBe('PATIENT');
      expect(res.body.data.password).toBeUndefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/register/physio', () => {
    it('should register a new physio with work schedules', async () => {
      const res = await request(app).post('/api/v1/auth/register/physio').send({
        email: 'physio@test.com',
        password: 'password123',
        name: 'Test Physio',
        pricePerSession: 5000,
        workSchedules: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
        ],
      });

      expect(res.status).toBe(HTTP_STATUS.CREATED);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe('physio@test.com');
      expect(res.body.data.name).toBe('Test Physio');
      expect(res.body.data.role).toBe('PHYSIO');
      expect(res.body.data.pricePerSession).toBe(5000);
      expect(res.body.data.password).toBeUndefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'login@test.com',
        password: 'password123',
        name: 'Login User',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'login@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe('login@test.com');
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout with valid session', async () => {
      const registerRes = await request(app).post('/api/v1/auth/register').send({
        email: 'logout@test.com',
        password: 'password123',
        name: 'Logout User',
      });

      const cookie = registerRes.headers['set-cookie'];

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user', async () => {
      const registerRes = await request(app).post('/api/v1/auth/register').send({
        email: 'me@test.com',
        password: 'password123',
        name: 'Me User',
      });

      const cookie = registerRes.headers['set-cookie'];

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', cookie);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe('me@test.com');
      expect(res.body.data.password).toBeUndefined();
    });
  });
});
