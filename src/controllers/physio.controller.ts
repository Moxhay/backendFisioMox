import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { success } from '../utils/response';

export async function getPhysios(req: Request, res: Response, next: NextFunction) {
  try {
    const physios = await prisma.user.findMany({
      where: { role: 'PHYSIO' },
      select: {
        id: true,
        name: true,
        email: true,
        pricePerSession: true,
        workSchedules: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    res.json(success(physios));
  } catch (err) {
    next(err);
  }
}

export function getPhysio(req: Request, res: Response) {
  res.json(success(req.physio));
}

export async function updatePrice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { pricePerSession } = req.body as { pricePerSession: number };

    const updatedPhysio = await prisma.user.update({
      where: { id },
      data: { pricePerSession },
      select: {
        id: true,
        name: true,
        pricePerSession: true,
      },
    });

    res.json(success(updatedPhysio));
  } catch (err) {
    next(err);
  }
}
