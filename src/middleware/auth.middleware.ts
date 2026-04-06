import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HTTP_STATUS, AUTH_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.signedCookies?.session_token;

    if (!token || token === false) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(error(AUTH_ERRORS.NOT_AUTHENTICATED, HTTP_STATUS.UNAUTHORIZED));
      return;
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(error(AUTH_ERRORS.INVALID_SESSION, HTTP_STATUS.UNAUTHORIZED));
      return;
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      res.status(HTTP_STATUS.UNAUTHORIZED).json(error(AUTH_ERRORS.SESSION_EXPIRED, HTTP_STATUS.UNAUTHORIZED));
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
