"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uidLimiter = exports.rewardsLimiter = void 0;
const express_rate_limit_1 = require("express-rate-limit");
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
