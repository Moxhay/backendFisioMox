import { Request, Response, NextFunction } from 'express';
import { Role } from '../generated/prisma/enums';
import { GENERAL_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !roles.includes(user.role as Role)) {
      res.status(GENERAL_ERRORS.FORBIDDEN.status).json(error(GENERAL_ERRORS.FORBIDDEN));
      return;
    }

    next();
  };
}
