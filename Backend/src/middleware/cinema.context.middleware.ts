import { randomUUID } from 'node:crypto';
import type { CinemaMiddleware } from '../types/cinema.http.types';
export const cinemaCorrelation: CinemaMiddleware = (req, res, next) => {
    const provided = req.header('X-Correlation-Id');
    req.correlationId =
        provided && /^[A-Za-z0-9_-]{1,64}$/.test(provided) ? provided : randomUUID();
    res.setHeader('X-Correlation-Id', req.correlationId);
    next();
};
