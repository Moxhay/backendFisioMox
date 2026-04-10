import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AUTH_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.signedCookies?.session_token;

    if (!token || token === false) {
      res.status(AUTH_ERRORS.NOT_AUTHENTICATED.status).json(error(AUTH_ERRORS.NOT_AUTHENTICATED));
      return;
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      res.status(AUTH_ERRORS.INVALID_SESSION.status).json(error(AUTH_ERRORS.INVALID_SESSION));
      return;
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      res.status(AUTH_ERRORS.SESSION_EXPIRED.status).json(error(AUTH_ERRORS.SESSION_EXPIRED));
      return;
    }

    const { password: _password, ...userWithoutPassword } = session.user;
    req.user = userWithoutPassword;
    req.sessionId = session.id;

    next();
  } catch (err) {
    next(err);
  }
}
