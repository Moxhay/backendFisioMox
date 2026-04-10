import { Request, Response, NextFunction } from 'express';
import { constructWebhookEvent } from '../lib/stripe';
import { WEBHOOK_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

export function validateStripeWebhook(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    res.status(WEBHOOK_ERRORS.MISSING_STRIPE_SIGNATURE.status).json(error(WEBHOOK_ERRORS.MISSING_STRIPE_SIGNATURE));
    return;
  }

  try {
    const event = constructWebhookEvent(req.body, signature);
    req.stripeEvent = event;
    next();
  } catch {
    res.status(WEBHOOK_ERRORS.INVALID_PAYLOAD.status).json(error(WEBHOOK_ERRORS.INVALID_PAYLOAD));
  }
}
