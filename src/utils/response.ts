import type { ApiError } from '../constants/errors';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function success<T>(data: T, pagination?: Pagination) {
  const response: { data: T; error: null; pagination?: Pagination } = { data, error: null };

  if (pagination) {
    response.pagination = pagination;
  }

  return response;
}

export function error<T = undefined>(apiError: ApiError, details?: T) {
  const response: { data: null; error: { message: string; errorCode: number; details?: T } } = {
    data: null,
    error: { message: apiError.message, errorCode: apiError.status },
  };

  if (details !== undefined) {
    response.error.details = details;
  }

  return response;
}

export function validationError(errors: { msg: string }[], code: number = 400) {
  const messages = errors.map((err) => err.msg);
  return { data: null, error: { messages, errorCode: code } };
}
