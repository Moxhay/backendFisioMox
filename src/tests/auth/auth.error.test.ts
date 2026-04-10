import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { HTTP_STATUS, AUTH_ERRORS } from '../../constants/errors';

describe('Auth Errors', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should fail with duplicate email', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'duplicate@test.com',
        password: 'password123',
        name: 'First User',
      });

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'duplicate@test.com',
        password: 'password123',
        name: 'Second User',
      });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail with invalid email', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
      });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail with short password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'short@test.com',
        password: '123',
        name: 'Test User',
      });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail without name', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'noname@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
  });

  describe('POST /api/v1/auth/register/physio', () => {
    it('should fail with duplicate email', async () => {
      await request(app).post('/api/v1/auth/register/physio').send({
        email: 'physio-dup@test.com',
        password: 'password123',
        name: 'First Physio',
        pricePerSession: 5000,
        workSchedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      });

      const res = await request(app).post('/api/v1/auth/register/physio').send({
        email: 'physio-dup@test.com',
        password: 'password123',
        name: 'Second Physio',
        pricePerSession: 5000,
        workSchedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail without pricePerSession', async () => {
      const res = await request(app).post('/api/v1/auth/register/physio').send({
        email: 'noprice@test.com',
        password: 'password123',
        name: 'No Price Physio',
        workSchedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail without workSchedules', async () => {
      const res = await request(app).post('/api/v1/auth/register/physio').send({
        email: 'noschedule@test.com',
        password: 'password123',
        name: 'No Schedule Physio',
        pricePerSession: 5000,
      });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('should fail with invalid workSchedule times', async () => {
      const res = await request(app).post('/api/v1/auth/register/physio').send({
        email: 'badtime@test.com',
        password: 'password123',
        name: 'Bad Time Physio',
        pricePerSession: 5000,
        workSchedules: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00' }],
      });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should fail with wrong password', async () => {
      await request(app).post('/api/v1/auth/register').send({
        email: 'wrongpass@test.com',
        password: 'password123',
        name: 'Wrong Pass User',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'wrongpass@test.com',
        password: 'wrongpassword',
      });

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.INVALID_CREDENTIALS.message);
    });

    it('should fail with non-existent email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.INVALID_CREDENTIALS.message);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should fail without session cookie', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });
  });
});
