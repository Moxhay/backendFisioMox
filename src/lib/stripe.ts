import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface CreatePaymentIntentParams {
  amount: number;
  paymentMethodId: string;
  appointmentId: string;
}

export async function createPaymentIntent({
  amount,
  paymentMethodId,
  appointmentId,
}: CreatePaymentIntentParams) {
  return stripe.paymentIntents.create({
    amount,
    currency: 'eur',
    payment_method: paymentMethodId,
    confirmation_method: 'automatic',
    confirm: true,
    return_url: `${process.env.FRONTEND_URL}/appointments/${appointmentId}/payment-complete`,
    metadata: {
      appointmentId,
    },
  });
}

export function isPaymentSucceeded(status: Stripe.PaymentIntent.Status): boolean {
  return status === 'succeeded';
}

export function requiresAction(status: Stripe.PaymentIntent.Status): boolean {
  return status === 'requires_action';
}

export async function refundPayment(paymentIntentId: string) {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
  });
}

export function constructWebhookEvent(payload: Buffer, signature: string) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}