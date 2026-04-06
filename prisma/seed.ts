import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role, AppointmentStatus, PaymentStatus } from '../src/generated/prisma/enums';
import bcrypt from 'bcryptjs';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// 5 Physiotherapists with different schedules
const physios = [
  {
    name: 'Dr. Elena Martinez',
    email: 'elena.martinez@fisiomox.com',
    pricePerSession: 4500,
    schedule: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '14:00' },
    ],
  },
  {
    name: 'Dr. Carlos Ruiz',
    email: 'carlos.ruiz@fisiomox.com',
    pricePerSession: 5000,
    schedule: [
      { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 2, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 4, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 5, startTime: '10:00', endTime: '18:00' },
    ],
  },
  {
    name: 'Dr. Ana Lopez',
    email: 'ana.lopez@fisiomox.com',
    pricePerSession: 5500,
    schedule: [
      { dayOfWeek: 1, startTime: '08:00', endTime: '14:00' },
      { dayOfWeek: 2, startTime: '08:00', endTime: '14:00' },
      { dayOfWeek: 3, startTime: '08:00', endTime: '14:00' },
      { dayOfWeek: 4, startTime: '14:00', endTime: '20:00' },
      { dayOfWeek: 5, startTime: '14:00', endTime: '20:00' },
    ],
  },
  {
    name: 'Dr. Miguel Torres',
    email: 'miguel.torres@fisiomox.com',
    pricePerSession: 4000,
    schedule: [
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 6, startTime: '09:00', endTime: '14:00' },
    ],
  },
  {
    name: 'Dr. Sofia Fernandez',
    email: 'sofia.fernandez@fisiomox.com',
    pricePerSession: 6000,
    schedule: [
      { dayOfWeek: 1, startTime: '11:00', endTime: '19:00' },
      { dayOfWeek: 3, startTime: '11:00', endTime: '19:00' },
      { dayOfWeek: 5, startTime: '11:00', endTime: '19:00' },
    ],
  },
];

// 5 Patients
const patients = [
  { name: 'Maria Garcia', email: 'maria.garcia@email.com' },
  { name: 'Pedro Sanchez', email: 'pedro.sanchez@email.com' },
  { name: 'Laura Fernandez', email: 'laura.fernandez@email.com' },
  { name: 'David Lopez', email: 'david.lopez@email.com' },
  { name: 'Carmen Diaz', email: 'carmen.diaz@email.com' },
];

// Notes for appointments
const appointmentNotes = [
  'Back pain after sports',
  'Knee rehabilitation',
  'Shoulder injury recovery',
  'Post-surgery follow-up',
  'Chronic neck pain',
  'Ankle sprain recovery',
  'Lower back treatment',
  'Muscle tension relief',
  null,
  null,
];

function getRandomNote(): string | null {
  return appointmentNotes[Math.floor(Math.random() * appointmentNotes.length)];
}

async function main() {
  console.log('Starting seed...\n');

  // Clean database
  console.log('Cleaning database...');
  await prisma.payment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.scheduleException.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  console.log('Database cleaned.\n');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create physiotherapists
  console.log('Creating physiotherapists...');
  const createdPhysios = [];

  for (const physio of physios) {
    const user = await prisma.user.create({
      data: {
        email: physio.email,
        name: physio.name,
        password: hashedPassword,
        role: Role.PHYSIO,
        pricePerSession: physio.pricePerSession,
      },
    });

    // Create work schedules
    for (const schedule of physio.schedule) {
      await prisma.workSchedule.create({
        data: {
          physioId: user.id,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
      });
    }

    console.log(`  - ${physio.name} (${physio.email}) - ${physio.pricePerSession / 100}€/session`);
    createdPhysios.push({ ...user, schedule: physio.schedule, pricePerSession: physio.pricePerSession });
  }

  // Create patients
  console.log('\nCreating patients...');
  const createdPatients = [];

  for (const patient of patients) {
    const user = await prisma.user.create({
      data: {
        email: patient.email,
        name: patient.name,
        password: hashedPassword,
        role: Role.PATIENT,
      },
    });
    console.log(`  - ${patient.name} (${patient.email})`);
    createdPatients.push(user);
  }

  // Create appointments for the next 7 days (half-filled schedules)
  console.log('\nCreating appointments for the next 7 days...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalAppointments = 0;

  for (const physio of createdPhysios) {
    let physioAppointments = 0;

    for (let day = 1; day <= 7; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() + day);

      // Get day of week (1-7, where 1 = Monday)
      let dayOfWeek = date.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;

      // Find schedule for this day
      const schedule = physio.schedule.find((s: { dayOfWeek: number }) => s.dayOfWeek === dayOfWeek);
      if (!schedule) continue;

      const startHour = parseInt(schedule.startTime.split(':')[0]);
      const endHour = parseInt(schedule.endTime.split(':')[0]);
      const totalSlots = endHour - startHour;

      // Book approximately half of the available slots
      const slotsToBook = Math.ceil(totalSlots / 2);

      // Generate all available hours
      const availableHours: number[] = [];
      for (let hour = startHour; hour < endHour; hour++) {
        availableHours.push(hour);
      }

      // Shuffle and pick random hours
      for (let i = availableHours.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableHours[i], availableHours[j]] = [availableHours[j], availableHours[i]];
      }

      const hoursToBook = availableHours.slice(0, slotsToBook).sort((a, b) => a - b);

      for (const hour of hoursToBook) {
        const patient = createdPatients[Math.floor(Math.random() * createdPatients.length)];

        const appointmentDateTime = new Date(date);
        appointmentDateTime.setHours(hour, 0, 0, 0);

        const appointment = await prisma.appointment.create({
          data: {
            physioId: physio.id,
            patientId: patient.id,
            dateTime: appointmentDateTime,
            duration: 60,
            status: AppointmentStatus.CONFIRMED,
            notes: getRandomNote(),
          },
        });

        await prisma.payment.create({
          data: {
            appointmentId: appointment.id,
            stripePaymentIntentId: `pi_seed_${appointment.id}`,
            amount: physio.pricePerSession,
            status: PaymentStatus.SUCCEEDED,
          },
        });

        physioAppointments++;
        totalAppointments++;
      }
    }

    console.log(`  - ${physio.name}: ${physioAppointments} appointments`);
  }

  // Create cancelled appointments (past week)
  console.log('\nCreating cancelled appointments...');

  let cancelledCount = 0;

  for (const physio of createdPhysios) {
    // Create 2-3 cancelled appointments per physio in the past week
    const cancelledPerPhysio = 2 + Math.floor(Math.random() * 2);

    for (let i = 0; i < cancelledPerPhysio; i++) {
      const daysAgo = 1 + Math.floor(Math.random() * 7);
      const date = new Date(today);
      date.setDate(date.getDate() - daysAgo);

      // Get day of week
      let dayOfWeek = date.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;

      const schedule = physio.schedule.find((s: { dayOfWeek: number }) => s.dayOfWeek === dayOfWeek);
      if (!schedule) continue;

      const startHour = parseInt(schedule.startTime.split(':')[0]);
      const hour = startHour + Math.floor(Math.random() * 4);

      const appointmentDateTime = new Date(date);
      appointmentDateTime.setHours(hour, 0, 0, 0);

      const patient = createdPatients[Math.floor(Math.random() * createdPatients.length)];

      // Randomly decide who cancelled (physio or patient)
      const cancelledByPhysio = Math.random() > 0.5;
      const cancelledById = cancelledByPhysio ? physio.id : patient.id;

      const appointment = await prisma.appointment.create({
        data: {
          physioId: physio.id,
          patientId: patient.id,
          dateTime: appointmentDateTime,
          duration: 60,
          status: AppointmentStatus.CANCELLED,
          cancelledById,
          notes: getRandomNote(),
        },
      });

      await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          stripePaymentIntentId: `pi_seed_cancelled_${appointment.id}`,
          amount: physio.pricePerSession,
          status: PaymentStatus.REFUNDED,
        },
      });

      cancelledCount++;
    }
  }

  console.log(`  - Created ${cancelledCount} cancelled appointments`);

  // Summary
  console.log('\n========================================');
  console.log('           SEED COMPLETED');
  console.log('========================================');
  console.log('\nCredentials (password: password123)');
  console.log('\nPhysiotherapists:');
  for (const physio of physios) {
    console.log(`  - ${physio.email}`);
  }
  console.log('\nPatients:');
  for (const patient of patients) {
    console.log(`  - ${patient.email}`);
  }
  console.log(`\nTotal confirmed appointments: ${totalAppointments}`);
  console.log(`Total cancelled appointments: ${cancelledCount}`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });