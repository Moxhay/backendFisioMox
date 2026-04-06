import 'dotenv/config';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.payment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.scheduleException.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.payment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.scheduleException.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
