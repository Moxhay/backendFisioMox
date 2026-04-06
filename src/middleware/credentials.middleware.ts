import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { comparePassword } from '../utils/password';
import { HTTP_STATUS, AUTH_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

const DUMMY_HASH = '$2b$10$dummyhashtopreventtimingattacksxxxxxxxxxxxxxxxxxxxxxxx';

export async function validateCredentials(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    const validPassword = await comparePassword(password, user?.password ?? DUMMY_HASH);

    if (!user || !validPassword) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(error(AUTH_ERRORS.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED));
      return;
    }

    const { password: _, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();
  } catch (err) {
    next(err);
  }
}
