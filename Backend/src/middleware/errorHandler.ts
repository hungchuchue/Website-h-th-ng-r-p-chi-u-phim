import { ErrorRequestHandler } from 'express';
import { AppError, logger } from '../utils/logger';

export { AppError } from '../utils/logger';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ code: error.statusCode, message: error.message, data: null });
    return;
  }

  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ code: 400, message: 'Invalid JSON request body.', data: null });
    return;
  }

  logger.error('Unhandled request error', { name: error instanceof Error ? error.name : 'UnknownError' });
  res.status(500).json({ code: 500, message: 'An unexpected error occurred.', data: null });
};
