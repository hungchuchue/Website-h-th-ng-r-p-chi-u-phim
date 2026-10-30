"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const errorHandler_1 = require("./errorHandler");
function getBearerToken(req) {
    const authorization = req.header('authorization');
    if (!authorization) {
        throw new errorHandler_1.AppError(401, 'AUTH_REQUIRED', 'A Bearer access token is required');
    }
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]?.trim()) {
        throw new errorHandler_1.AppError(401, 'INVALID_TOKEN', 'The Authorization header is malformed');
    }
    return match[1].trim();
}
const userRoles = ['user', 'editor', 'admin'];
function isUserRole(value) {
    return typeof value === 'string' && userRoles.includes(value);
}
function requireAuth(req, _res, next) {
    try {
        const decoded = jsonwebtoken_1.default.verify(getBearerToken(req), config_1.config.jwt.secret);
        if (decoded.type !== 'access'
            || !decoded.sub
            || !isUserRole(decoded.role)) {
            throw new errorHandler_1.AppError(401, 'INVALID_TOKEN', 'Access token is invalid');
        }
        req.auth = {
            userId: decoded.sub,
            role: decoded.role,
        };
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError)
            return next(error);
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return next(new errorHandler_1.AppError(401, 'TOKEN_EXPIRED', 'Access token has expired'));
        }
        next(new errorHandler_1.AppError(401, 'INVALID_TOKEN', 'Access token is invalid'));
    }
}
function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.auth)
            return next(new errorHandler_1.AppError(401, 'AUTH_REQUIRED', 'Authentication is required'));
        if (!roles.includes(req.auth.role)) {
            return next(new errorHandler_1.AppError(403, 'FORBIDDEN', 'You do not have permission for this action'));
        }
        next();
    };
}
//# sourceMappingURL=requireAuth.js.map