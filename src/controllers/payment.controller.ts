import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { success } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';
import { buildAppointmentFilter, paymentInclude } from '../utils/queryBuilders';
import { Prisma } from '../generated/prisma/client';

export async function getPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: userId, role } = req.user!;
    const { page, month } = req.query as { page?: string; month?: string };

    const pagination = parsePagination(page);
    const appointmentFilter = buildAppointmentFilter(role, userId, month);

    const where: Prisma.PaymentWhereInput = {
      appointment: appointmentFilter,
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: paymentInclude.withAppointment,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json(success(payments, buildPaginationMeta(pagination, total)));
  } catch (err) {
    next(err);
  }
}

export async function getPaymentExceptions(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: userId, role } = req.user!;
    const { page, month } = req.query as { page?: string; month?: string };

    const pagination = parsePagination(page);
    const appointmentFilter = buildAppointmentFilter(role, userId, month);

    const where: Prisma.PaymentWhereInput = {
      appointment: appointmentFilter,
      OR: [
        { status: 'REFUNDED' },
        { status: 'FAILED' },
        { appointment: { status: 'CANCELLED' } },
      ],
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: paymentInclude.withAppointment,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json(success(payments, buildPaginationMeta(pagination, total)));
  } catch (err) {
    next(err);
  }
}

export async function getPaymentStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: userId, role } = req.user!;
    const { month } = req.query as { month?: string };

    const appointmentFilter = buildAppointmentFilter(role, userId, month);

    const result = await prisma.payment.aggregate({
      where: {
        appointment: appointmentFilter,
        status: 'SUCCEEDED',
      },
      _sum: { amount: true },
    });

    res.json(success({ totalRevenue: result._sum.amount || 0 }));
  } catch (err) {
    next(err);
  }
}
