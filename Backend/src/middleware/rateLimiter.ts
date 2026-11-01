import { rateLimit } from 'express-rate-limit';
import { Request } from 'express';

// Rewards: max 10 per minute per IP
export const rewardsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
});

// Generate/Upload: max 10 per minute per UID
export const uidLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req: Request) => (req as any).uid || req.ip,
    message: { error: 'RATE_LIMIT', message: 'Too many requests for this account. Please slow down.' }
});
