export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const GENERAL_ERRORS = {
  INTERNAL_SERVER_ERROR: 'Internal server error',
  FORBIDDEN: 'Forbidden',
  ACCESS_DENIED: 'Access denied',
} as const;

export const AUTH_ERRORS = {
  NOT_AUTHENTICATED: 'Not authenticated',
  INVALID_SESSION: 'Invalid session',
  SESSION_EXPIRED: 'Session expired',
  INVALID_CREDENTIALS: 'Invalid credentials',
} as const;

export const APPOINTMENT_ERRORS = {
  ID_REQUIRED: 'Appointment ID is required',
  NOT_FOUND: 'Appointment not found',
  ALREADY_CANCELLED: 'Appointment already cancelled',
  SLOT_ALREADY_BOOKED: 'Slot already booked',
  TOO_LATE_TO_CANCEL: 'Cannot cancel appointment less than 2 hours before scheduled time',
  NOT_PENDING: 'Appointment is not pending',
  RESERVATION_EXPIRED: 'Reservation expired',
} as const;

export const PHYSIO_ERRORS = {
  NOT_FOUND: 'Physio not found',
  ID_AND_DATE_REQUIRED: 'physioId and date are required',
  DOES_NOT_WORK_THIS_DAY: 'Physio does not work this day',
  NO_PRICE_CONFIGURED: 'Physio has no price configured',
  DAY_OFF: 'Day off',
} as const;

export const SCHEDULE_EXCEPTION_ERRORS = {
  NOT_FOUND: 'Schedule exception not found',
  ALREADY_EXISTS: 'An exception already exists for this date',
  APPOINTMENTS_CONFLICT: 'There are appointments that conflict with this exception',
} as const;

export const WORK_SCHEDULE_ERRORS = {
  APPOINTMENTS_CONFLICT: 'There are appointments that conflict with the new schedule',
} as const;

export const PAYMENT_ERRORS = {
  NOT_FOUND: 'Payment not found',
  ALREADY_REFUNDED: 'Payment already refunded',
  PAYMENT_FAILED: 'Payment failed',
} as const;

export const WEBHOOK_ERRORS = {
  MISSING_STRIPE_SIGNATURE: 'Missing stripe-signature header',
  MISSING_APPOINTMENT_ID_METADATA: 'Missing appointmentId in metadata',
  INVALID_PAYLOAD: 'Invalid webhook payload',
} as const;
