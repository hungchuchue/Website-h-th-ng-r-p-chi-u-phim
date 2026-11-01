import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    userEmail?: string;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ code: 401, message: 'Missing or invalid token.', data: 'UNAUTHORIZED' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const payload = jwt.verify(idToken, config.jwt.secret) as jwt.JwtPayload;
        req.userEmail = payload.email;
        next();
    } catch (error: any) {
        console.error('[Auth Middleware] Error:', error.name, error.message);

        // Xử lý các mã lỗi phổ biến của thư viện jsonwebtoken
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ code: 401, message: 'Token expired.', data: 'TOKEN_EXPIRED' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ code: 401, message: 'Invalid token.', data: 'INVALID_TOKEN' });
        }
        if (error.name === 'NotBeforeError') {
            return res.status(401).json({ code: 401, message: 'Token not active yet.', data: 'TOKEN_NOT_ACTIVE' });
        }

        // Lỗi không xác định
        return res.status(401).json({ code: 401, message: 'Unauthorized.', data: 'UNAUTHORIZED' });
    }
};
