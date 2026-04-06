import { prisma } from '../lib/prisma';
import { refundPayment } from '../lib/stripe';
import { logger } from './logger';

interface PaymentInfo {
  id: string;
  stripePaymentIntentId: string;
  status: string;
}

export async function processRefundIfNeeded(
  payment: PaymentInfo | null | undefined,
  appointmentId: string
): Promise<boolean> {
  if (!payment || payment.status !== 'SUCCEEDED') {
    return false;
  }

  try {
    await refundPayment(payment.stripePaymentIntentId);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED' },
    });
    return true;
  } catch (refundError) {
    logger.error('Refund failed', refundError, { appointmentId });
    return false;
  }
}

export async function processRefundInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  payment: PaymentInfo | null | undefined,
  appointmentId: string
): Promise<boolean> {
  if (!payment || payment.status !== 'SUCCEEDED') {
    return false;
  }

  try {
    await refundPayment(payment.stripePaymentIntentId);
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED' },
    });
    return true;
  } catch (refundError) {
    logger.error('Refund failed', refundError, { appointmentId });
    return false;
  }
}
