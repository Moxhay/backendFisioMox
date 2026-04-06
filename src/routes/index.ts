import { Router } from 'express';
import { authRouter } from './auth.routes';
import { workScheduleRouter } from './workSchedule.routes';
import { appointmentRouter } from './appointment.routes';
import { physioRouter } from './physio.routes';
import { scheduleExceptionRouter } from './scheduleException.routes';
import { paymentRouter } from './payment.routes';

const router = Router();

const v1 = Router();
v1.use('/auth', authRouter);
v1.use('/work-schedule', workScheduleRouter);
v1.use('/appointments', appointmentRouter);
v1.use('/physios', physioRouter);
v1.use('/schedule-exceptions', scheduleExceptionRouter);
v1.use('/payments', paymentRouter);

router.use('/v1', v1);

export default router;
