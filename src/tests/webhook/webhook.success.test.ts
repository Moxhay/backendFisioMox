import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
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

describe('Webhook Success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/webhook/stripe', () => {
    it('should acknowledge webhook event', async () => {
      vi.mocked(stripeLib.constructWebhookEvent).mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount: 5000,
            metadata: {},
          },
        },
      } as never);

      const res = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ type: 'payment_intent.succeeded' }));

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.received).toBe(true);
    });
  });
});
