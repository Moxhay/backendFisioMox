import { Router } from 'express';
import { getPhysios, getPhysio, updatePrice } from '../controllers/physio.controller';
import { physioLimiter } from '../middleware/rateLimiter.middleware';
import { validatePhysioId, validatePhysioExists, validateUpdatePrice, validateCanUpdatePrice } from '../middleware/physio.validation';
import { authenticate } from '../middleware/auth.middleware';

export const physioRouter = Router();

physioRouter.get('/', physioLimiter, getPhysios);
physioRouter.get('/:id', physioLimiter, validatePhysioId, validatePhysioExists, getPhysio);
physioRouter.patch('/:id/price', physioLimiter, authenticate, validateUpdatePrice, validateCanUpdatePrice, updatePrice);
