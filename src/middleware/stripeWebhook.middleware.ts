import { Request, Response, NextFunction } from 'express';
import { constructWebhookEvent } from '../lib/stripe';
import { HTTP_STATUS, WEBHOOK_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

export function validateStripeWebhook(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(error(WEBHOOK_ERRORS.MISSING_STRIPE_SIGNATURE, HTTP_STATUS.BAD_REQUEST));
    return;
  }

  try {
    const event = constructWebhookEvent(req.body, signature);
    req.stripeEvent = event;
    next();
  } catch {
    res.status(HTTP_STATUS.BAD_REQUEST).json(error(WEBHOOK_ERRORS.INVALID_PAYLOAD, HTTP_STATUS.BAD_REQUEST));
  }
}