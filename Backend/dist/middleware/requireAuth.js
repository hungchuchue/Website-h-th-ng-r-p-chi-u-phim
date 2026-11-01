"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const config_1 = require("../config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ code: 401, message: 'Missing or invalid token.', data: 'UNAUTHORIZED' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const payload = jsonwebtoken_1.default.verify(idToken, config_1.config.jwt.secret);
        req.userEmail = payload.email;
        next();
    }
    catch (error) {
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
exports.requireAuth = requireAuth;
