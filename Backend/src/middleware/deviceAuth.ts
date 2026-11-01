import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/logger';

export interface AuthRequest extends Request {
  deviceId?: string;
}

export const deviceAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const deviceId = req.headers['x-device-id'] as string;

    if (!deviceId || deviceId.trim() === '') {
      throw new AppError(400, 'MISSING_DEVICE_ID', 'Header X-Device-ID is required');
    }

    req.deviceId = deviceId.trim();
    next();
  } catch (error) {
    next(error);
  }
};