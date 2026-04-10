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
  INTERNAL_SERVER_ERROR: {
    message: 'Internal server error',
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  },
  NOT_FOUND: {
    message: 'Not found',
    status: HTTP_STATUS.NOT_FOUND,
  },
  FORBIDDEN: {
    message: 'Forbidden',
    status: HTTP_STATUS.FORBIDDEN,
  },
  ACCESS_DENIED: {
    message: 'Access denied',
    status: HTTP_STATUS.FORBIDDEN,
  },
} as const;

export const AUTH_ERRORS = {
  NOT_AUTHENTICATED: {
    message: 'Not authenticated',
    status: HTTP_STATUS.UNAUTHORIZED,
  },
  INVALID_SESSION: {
    message: 'Invalid session',
    status: HTTP_STATUS.UNAUTHORIZED,
  },
  SESSION_EXPIRED: {
    message: 'Session expired',
    status: HTTP_STATUS.UNAUTHORIZED,
  },
  INVALID_CREDENTIALS: {
    message: 'Invalid credentials',
    status: HTTP_STATUS.UNAUTHORIZED,
  },
} as const;

export const APPOINTMENT_ERRORS = {
  ID_REQUIRED: {
    message: 'Appointment ID is required',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  NOT_FOUND: {
    message: 'Appointment not found',
    status: HTTP_STATUS.NOT_FOUND,
  },
  ALREADY_CANCELLED: {
    message: 'Appointment already cancelled',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  SLOT_ALREADY_BOOKED: {
    message: 'Slot already booked',
    status: HTTP_STATUS.CONFLICT,
  },
  TOO_LATE_TO_CANCEL: {
    message: 'Cannot cancel appointment less than 2 hours before scheduled time',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  NOT_PENDING: {
    message: 'Appointment is not pending',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  RESERVATION_EXPIRED: {
    message: 'Reservation expired',
    status: HTTP_STATUS.BAD_REQUEST,
  },
} as const;

export const PHYSIO_ERRORS = {
  NOT_FOUND: {
    message: 'Physio not found',
    status: HTTP_STATUS.NOT_FOUND,
  },
  ID_AND_DATE_REQUIRED: {
    message: 'physioId and date are required',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  DOES_NOT_WORK_THIS_DAY: {
    message: 'Physio does not work this day',
    status: HTTP_STATUS.NOT_FOUND,
  },
  NO_PRICE_CONFIGURED: {
    message: 'Physio has no price configured',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  DAY_OFF: {
    message: 'Day off',
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  },
} as const;

export const SCHEDULE_EXCEPTION_ERRORS = {
  NOT_FOUND: {
    message: 'Schedule exception not found',
    status: HTTP_STATUS.NOT_FOUND,
  },
  ALREADY_EXISTS: {
    message: 'An exception already exists for this date',
    status: HTTP_STATUS.CONFLICT,
  },
  APPOINTMENTS_CONFLICT: {
    message: 'There are appointments that conflict with this exception',
    status: HTTP_STATUS.CONFLICT,
  },
} as const;

export const WORK_SCHEDULE_ERRORS = {
  APPOINTMENTS_CONFLICT: {
    message: 'There are appointments that conflict with the new schedule',
    status: HTTP_STATUS.CONFLICT,
  },
} as const;

export const PAYMENT_ERRORS = {
  NOT_FOUND: {
    message: 'Payment not found',
    status: HTTP_STATUS.NOT_FOUND,
  },
  ALREADY_REFUNDED: {
    message: 'Payment already refunded',
    status: HTTP_STATUS.CONFLICT,
  },
  PAYMENT_FAILED: {
    message: 'Payment failed',
    status: HTTP_STATUS.BAD_REQUEST,
  },
} as const;

export const WEBHOOK_ERRORS = {
  MISSING_STRIPE_SIGNATURE: {
    message: 'Missing stripe-signature header',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  MISSING_APPOINTMENT_ID_METADATA: {
    message: 'Missing appointmentId in metadata',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  INVALID_PAYLOAD: {
    message: 'Invalid webhook payload',
    status: HTTP_STATUS.BAD_REQUEST,
  },
} as const;

export type ApiError = {
  message: string;
  status: number;
};
