import { Router, raw } from 'express';
import { handleStripeWebhook } from '../controllers/webhook.controller';
import { validateStripeWebhook } from '../middleware/stripeWebhook.middleware';

export const webhookRouter = Router();

webhookRouter.post(
  '/stripe',
  raw({ type: 'application/json' }),
  validateStripeWebhook,
  handleStripeWebhook
);
