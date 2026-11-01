import { Request, Response, NextFunction } from 'express';
import { BaseResponse } from '../types/responses';
import { AppError } from '../utils/logger';

export const errorHandler = (err: Error, req: Request, res: Response<BaseResponse<null>>, next: NextFunction) => {
  console.error(`[Error] ${err.message}`, err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.statusCode,
      message: err.message,
      data: null
    });
  }

  // Default 500
  res.status(500).json({
    code: 500,
    message: 'An unexpected error occurred.',
    data: null
  });
};
