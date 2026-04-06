import { Request, Response, NextFunction } from 'express';
import { Role } from '../generated/prisma/enums';
import { HTTP_STATUS, GENERAL_ERRORS } from '../constants/errors';
import { error } from '../utils/response';

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !roles.includes(user.role as Role)) {
      res.status(HTTP_STATUS.FORBIDDEN).json(error(GENERAL_ERRORS.FORBIDDEN, HTTP_STATUS.FORBIDDEN));
      return;
    }

    next();
  };
}