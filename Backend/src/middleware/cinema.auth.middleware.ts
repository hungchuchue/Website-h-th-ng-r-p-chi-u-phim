import { AppError } from '../utils/logger';
import type { CinemaIdentity } from '../types/cinema.auth.types';
import type { CinemaHttpRequest, CinemaMiddleware } from '../types/cinema.http.types';
import type { CinemaPorts } from '../types/cinema.routes.types';
export function identity(req: CinemaHttpRequest): CinemaIdentity {
    if (!req.cinemaAuth)
        throw new AppError(401, 'UNAUTHORIZED', 'Cinema authentication is required.');
    return req.cinemaAuth;
}
export function cinemaProtectedRoute(
    auth: CinemaPorts['auth'],
): (access: 'AUTHENTICATED' | 'CUSTOMER' | 'ADMIN') => CinemaMiddleware {
    const middleware =
        (access: 'AUTHENTICATED' | 'CUSTOMER' | 'ADMIN'): CinemaMiddleware =>
        (req, _res, next) => {
            auth.authenticate(req.header('Authorization'))
                .then((user) => {
                    if (access !== 'AUTHENTICATED' && user.role !== access)
                        throw new AppError(
                            403,
                            'FORBIDDEN',
                            'This operation is not allowed for your Cinema role.',
                        );
                    req.cinemaAuth = user;
                    next();
                })
                .catch(next);
        };
    return middleware;
}
