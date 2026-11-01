import type { CinemaInput, JsonObject } from '../types/cinema.input.types';
import { createHash } from 'node:crypto';
import { AppError } from './logger';
import type { Page } from '../types/cinema.types';
export const invalid = (message: string): never => {
    throw new AppError(400, 'INVALID_REQUEST', message);
};
export function object(value: CinemaInput, allowed: readonly string[]): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return invalid('A JSON object is required.');
    const data = value;
    if (Object.keys(data).some((k) => !allowed.includes(k)))
        return invalid('Request contains unsupported fields.');
    return data;
}
export function text(value: CinemaInput, name: string, max = 200, min = 1): string {
    if (typeof value !== 'string' || value.trim().length < min || value.length > max)
        return invalid(`${name} must be a string with ${min}-${max} characters.`);
    return value.trim();
}
export function positiveId(value: CinemaInput, name = 'id'): number {
    const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 2147483647)
        return invalid(`${name} must be a positive SQL integer.`);
    return n;
}
export function money(value: CinemaInput, name = 'amount', maximum = 1000000000): number {
    if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > maximum ||
        Number(value.toFixed(2)) !== value
    )
        return invalid(
            `${name} must be a non-negative VND amount with at most two decimals (maximum ${maximum}).`,
        );
    return value;
}
export function email(value: CinemaInput): string {
    const s = text(value, 'email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return invalid('A valid email is required.');
    return s;
}
export function password(value: CinemaInput, registration = false): string {
    if (typeof value !== 'string' || value.length < (registration ? 12 : 1) || value.length > 128)
        return invalid(
            'Password length must be 12-128 characters when registering, and 1-128 when logging in.',
        );
    return value;
}
export function choice<T extends string>(
    value: CinemaInput,
    values: readonly T[],
    name: string,
): T {
    if (typeof value !== 'string' || !values.some((item) => item === value))
        return invalid(`${name} must be one of: ${values.join(', ')}.`);
    return (
        values.find((item) => item === value) ??
        invalid(`${name} must be one of: ${values.join(', ')}.`)
    );
}
export function seatIds(value: CinemaInput): number[] {
    if (!Array.isArray(value) || !value.length || value.length > 1000)
        return invalid('seatIds must contain 1-1000 seats.');
    const ids = value.map((x) => positiveId(x, 'seatId')).sort((a, b) => a - b);
    if (new Set(ids).size !== ids.length) return invalid('Duplicate seat IDs are not allowed.');
    return ids;
}
export function idempotencyKey(value: CinemaInput): string {
    const s = text(value, 'Idempotency-Key', 128);
    if (!/^[\x21-\x7e]+$/.test(s))
        return invalid('Idempotency-Key must contain printable ASCII without spaces.');
    return s;
}
export function holdHash(showtimeId: number, seats: number[]): string {
    return createHash('sha256')
        .update(JSON.stringify({ showtimeId, seatIds: [...seats].sort((a, b) => a - b) }))
        .digest('hex');
}
export function pagination(query: JsonObject): Page {
    const page = query.page === undefined ? 1 : positiveId(query.page, 'page'),
        limit = query.limit === undefined ? 20 : positiveId(query.limit, 'limit');
    if (limit > 100 || page > 100000)
        return invalid('limit cannot exceed 100 and page cannot exceed 100000.');
    return { page, limit, offset: (page - 1) * limit };
}
export function utcDateTime(value: CinemaInput, name = 'startsAt'): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
        return invalid(`${name} must be an ISO timestamp with a timezone.`);
    calendarDate(value.slice(0, 10));
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return invalid(`Invalid ${name}.`);
    return d;
}
export function calendarDate(value: CinemaInput): string | undefined {
    if (value === undefined) return undefined;
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value + 'T00:00:00Z')) ||
        new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value
    )
        return invalid('date must be a valid YYYY-MM-DD UTC date.');
    return value;
}
export function url(value: CinemaInput, name: string, optional?: false): string;
export function url(value: CinemaInput, name: string, optional: true): string | null;
export function url(value: CinemaInput, name: string, optional: boolean): string | null;
export function url(value: CinemaInput, name: string, optional = false): string | null {
    if (optional && (value === null || value === undefined || value === '')) return null;
    const s = text(value, name, 2048);
    try {
        if (!['http:', 'https:'].includes(new URL(s).protocol))
            return invalid(`${name} must use HTTP or HTTPS.`);
    } catch {
        return invalid(`${name} must be a valid URL.`);
    }
    return s;
}
