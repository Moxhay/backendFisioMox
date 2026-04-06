import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { success } from '../utils/response';
import { logger } from '../utils/logger';

export async function handleStripeWebhook(req: Request, res: Response, next: NextFunction) {
  const event = req.stripeEvent!;

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        logger.warn('Unhandled Stripe event type', { eventType: event.type });
    }

    res.json(success({ received: true }));
  } catch (err) {
    next(err);
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { appointmentId } = paymentIntent.metadata;

  if (!appointmentId) {
    logger.error('Payment succeeded but no appointmentId in metadata', null, { paymentIntentId: paymentIntent.id });
    return;
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: { status: 'SUCCEEDED' },
    }),
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CONFIRMED', expiresAt: null },
    }),
  ]);
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { appointmentId } = paymentIntent.metadata;

  if (!appointmentId) {
    logger.error('Payment failed but no appointmentId in metadata', null, { paymentIntentId: paymentIntent.id });
    return;
  }

  await prisma.payment.update({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: { status: 'FAILED' },
  });

  await prisma.appointment.delete({
    where: { id: appointmentId },
  }).catch(() => {});
}
