import jwt from 'jsonwebtoken';
import { AppError } from '../utils/logger';
import { config } from '../config';
import { verifyPassword } from '../utils/validation';

export const adminAuthService = {
  async login(email: string, password: string) {
    const emailCheck = email.trim().toLowerCase();

    if (emailCheck !== config.admin.email || !verifyPassword(password, config.admin.password)) {
      throw new AppError(401, 'INVALID_ADMIN_CREDENTIALS', 'Invalid admin credentials.');
    }

    const token = jwt.sign(
      { sub: emailCheck, email: emailCheck, role: 'admin', type: 'access' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );
    return {
      accessToken: token,
      tokenType: 'Bearer' as const,
      expiresIn: config.jwt.expiresIn
    };
  }
};