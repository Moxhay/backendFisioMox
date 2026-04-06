export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function generateTimeSlots(startTime: string, endTime: string, durationMinutes: number): string[] {
  const slots: string[] = [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  let current = start;
  while (current + durationMinutes <= end) {
    slots.push(minutesToTime(current));
    current += durationMinutes;
  }

  return slots;
}

export function formatTimeFromDate(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function isTimeWithinRange(
  appointmentTime: string,
  startTime: string,
  endTime: string,
  slotDuration: number
): boolean {
  const appointmentMinutes = timeToMinutes(appointmentTime);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return appointmentMinutes >= startMinutes && appointmentMinutes + slotDuration <= endMinutes;
}