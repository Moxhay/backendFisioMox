import crypto from 'crypto';

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getTokenExpiry(): Date {
  const days = parseInt(process.env.SESSION_EXPIRY_DAYS || '7', 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}
