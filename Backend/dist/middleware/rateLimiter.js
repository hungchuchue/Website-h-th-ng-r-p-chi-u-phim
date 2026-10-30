"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRateLimiter = exports.uidLimiter = exports.rewardsLimiter = exports.authLimiter = void 0;
const express_rate_limit_1 = require("express-rate-limit");
// Auth sync: max 30 per minute per IP
exports.authLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 60 * 1000,
    max: 30,
});
// Rewards: max 10 per minute per IP
exports.rewardsLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 60 * 1000,
    max: 10,
});
// Generate/Upload: max 10 per minute per UID
exports.uidLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.uid || req.ip,
    message: { error: 'RATE_LIMIT', message: 'Too many requests for this account. Please slow down.' }
});
exports.aiRateLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
});
//# sourceMappingURL=rateLimiter.js.map