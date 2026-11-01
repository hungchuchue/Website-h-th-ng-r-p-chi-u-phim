import { AppError } from '../utils/logger';
import type { CinemaMiddleware } from '../types/cinema.http.types';
export function cinemaAuthLimit(): CinemaMiddleware {
    const attempts = new Map<
        string,
        {
            count: number;
            until: number;
        }
    >();
    const authLimit: CinemaMiddleware = (req, _res, next) => {
        const now = Date.now(),
            key = req.ip || req.socket.remoteAddress || 'unknown';
        if (attempts.size > 10000)
            for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
        let count = attempts.get(key);
        if (!count || count.until <= now) {
            count = { count: 0, until: now + 60000 };
            attempts.set(key, count);
        }
        count.count++;
        count.count > 30
            ? next(
                  new AppError(
                      429,
                      'RATE_LIMIT',
                      'Too many authentication requests. Try again in one minute.',
                  ),
              )
            : next();
    };
    return authLimit;
}
