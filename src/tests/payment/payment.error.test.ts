import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { HTTP_STATUS, AUTH_ERRORS } from '../../constants/errors';

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

describe('Payment Errors', () => {
  describe('GET /api/v1/payments', () => {
    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/payments');

      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(res.body.error.message).toBe(AUTH_ERRORS.NOT_AUTHENTICATED.message);
    });
  });
});
