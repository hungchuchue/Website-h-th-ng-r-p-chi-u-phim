import type { ErrorRequestHandler } from 'express';
import type { BaseResponse } from '../types/responses';
import type { CinemaInput, CinemaQuery, CinemaFailure } from '../types/cinema.input.types';
import type { CinemaParams } from '../types/cinema.request.types';
import { AppError } from '../utils/logger';
export function sqlErrorNumber<T>(error: T): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    if ('number' in error && typeof error.number === 'number') return error.number;
    if (
        'originalError' in error &&
        error.originalError &&
        typeof error.originalError === 'object' &&
        'info' in error.originalError
    ) {
        const nested = sqlErrorNumber(error.originalError.info);
        if (nested !== undefined) return nested;
    }
    if ('precedingErrors' in error && Array.isArray(error.precedingErrors)) {
        for (const preceding of error.precedingErrors) {
            const nested = sqlErrorNumber(preceding);
            if (nested !== undefined) return nested;
        }
    }
    return undefined;
}
export const cinemaErrorHandler: ErrorRequestHandler<
    CinemaParams,
    BaseResponse<null>,
    CinemaInput,
    CinemaQuery
> = (error: CinemaFailure, req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }
    let status = 500,
        message = 'An unexpected Cinema error occurred.';
    const number = sqlErrorNumber(error);
    if (error instanceof AppError) {
        status = error.statusCode;
        message = error.message;
    } else if (number === 51000) {
        status = 400;
        message = 'The request violates a Cinema business validation rule.';
    } else if (number === 51001) {
        status = 404;
        message = 'Resource not found.';
    } else if ([51002, 51400, 2601, 2627].includes(number ?? 0)) {
        status = 409;
        message =
            'The request conflicts with the current resource state. Seats may be unavailable or the idempotency key was reused.';
    } else if (number === 51302) {
        status = 422;
        message = 'The booking contains no seats.';
    } else if (number === 547) {
        status = 409;
        message = 'The operation conflicts with related Cinema data.';
    } else if (number === 1205) {
        status = 503;
        message = 'Database contention. Retry using the same Idempotency-Key.';
    } else if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['ETIMEOUT', 'ESOCKET', 'ECONNCLOSED', 'ELOGIN'].includes(String(error.code))
    ) {
        status = 503;
        message =
            'Cinema database is unavailable. Retry using the same Idempotency-Key; payment state has not been assumed.';
    }
    console[status >= 500 ? 'error' : 'info']('[Cinema]', {
        correlationId: req.correlationId,
        status,
        sqlNumber: number,
    });
    res.status(status).json({ code: status, message, data: null });
};
