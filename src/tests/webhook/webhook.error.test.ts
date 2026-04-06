import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { HTTP_STATUS, WEBHOOK_ERRORS } from '../../constants/errors';
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

describe('Webhook Errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/webhook/stripe', () => {
    it('should fail without stripe-signature header', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ type: 'payment_intent.succeeded' }));

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.error.message).toBe(WEBHOOK_ERRORS.MISSING_STRIPE_SIGNATURE);
    });

    it('should fail with invalid signature', async () => {
      vi.mocked(stripeLib.constructWebhookEvent).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const res = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ type: 'payment_intent.succeeded' }));

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.error.message).toBe(WEBHOOK_ERRORS.INVALID_PAYLOAD);
    });
  });
});
