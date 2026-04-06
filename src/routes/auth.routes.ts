import { Router } from 'express';
import { register, registerPhysio, login, logout, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter, authMeLimiter } from '../middleware/rateLimiter.middleware';
import {
  validateRegister,
  validateRegisterPhysio,
  validateLogin,
} from '../middleware/validation.middleware';
import { validateCredentials } from '../middleware/credentials.middleware';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateRegister, register);
authRouter.post('/register/physio', authLimiter, validateRegisterPhysio, registerPhysio);
authRouter.post('/login', authLimiter, validateLogin, validateCredentials, login);
authRouter.post('/logout', authMeLimiter, authenticate, logout);
authRouter.get('/me', authMeLimiter, authenticate, me);
