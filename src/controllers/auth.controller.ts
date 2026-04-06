import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { User, Prisma } from '../generated/prisma/client';
import { hashPassword } from '../utils/password';
import { generateToken, getTokenExpiry } from '../utils/token';
import { success } from '../utils/response';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  signed: true,
  path: '/',
};

interface WorkScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function createSessionWithCookie(res: Response, userId: string) {
  const token = generateToken();
  const expiresAt = getTokenExpiry();

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  res.cookie('session_token', token, { ...COOKIE_OPTIONS, expires: expiresAt });
}

function excludePassword(user: User) {
  const { password: _password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body;

    const newUser = await prisma.user.create({
      data: {
        email,
        password: await hashPassword(password),
        name,
        role: 'PATIENT',
      },
    });

    await createSessionWithCookie(res, newUser.id);
    res.status(201).json(success(excludePassword(newUser)));
  } catch (err) {
    next(err);
  }
}

export async function registerPhysio(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name, pricePerSession, workSchedules } = req.body;

    const user = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password: await hashPassword(password),
          name,
          role: 'PHYSIO',
          pricePerSession,
        },
      });

      await tx.workSchedule.createMany({
        data: workSchedules.map((s: WorkScheduleInput) => ({
          physioId: newUser.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });

      return newUser;
    });

    await createSessionWithCookie(res, user.id);
    res.status(201).json(success(excludePassword(user)));
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    await createSessionWithCookie(res, req.user!.id);
    res.json(success(req.user));
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.session.deleteMany({ where: { id: req.sessionId } });
    res.clearCookie('session_token', COOKIE_OPTIONS);
    res.json(success({ message: 'Logged out successfully' }));
  } catch (err) {
    next(err);
  }
}

export function me(req: Request, res: Response) {
  res.json(success(req.user));
}
