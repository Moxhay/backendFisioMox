import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function cleanupExpiredReservations() {
  try {
    const result = await prisma.appointment.deleteMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      logger.info('Cleaned up expired reservations', { count: result.count });
    }
  } catch (err) {
    logger.error('Error cleaning up expired reservations', err);
  }
}

export function startCleanupJob() {
  logger.info('Starting cleanup job (every 5 minutes)');
  cleanupExpiredReservations();
  setInterval(cleanupExpiredReservations, CLEANUP_INTERVAL_MS);
}
