import type { CinemaSettings } from '../types/cinema.config.types';
import type { config as SqlConfig } from 'mssql';
export function cinemaEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.CINEMA_ENABLED === 'true';
}
function integer(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
    name: string,
): number {
    const n = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(n) || n < min || n > max)
        throw new Error(`${name} must be an integer between ${min} and ${max}`);
    return n;
}
export function cinemaSettings(env: NodeJS.ProcessEnv = process.env): CinemaSettings {
    return {
        enabled: cinemaEnabled(env),
        environment: env.NODE_ENV || 'development',
        holdMinutes: integer(env.CINEMA_HOLD_MINUTES, 7, 5, 10, 'CINEMA_HOLD_MINUTES'),
        jwtSecret: env.CINEMA_JWT_SECRET || '',
        issuer: 'troond-cinema',
        audience: 'troond-cinema-api',
        jwtTtl: 900,
        workers: env.CINEMA_WORKERS_ENABLED !== 'false',
        simulatorSecret: env.CINEMA_SIMULATOR_SECRET || '',
        paymentProvider: env.CINEMA_PAYMENT_PROVIDER || 'simulator',
        baseUrl: env.CINEMA_PUBLIC_URL || `http://localhost:${env.PORT || '3002'}`,
    };
}
export function requireCinemaJwt(env: NodeJS.ProcessEnv = process.env): CinemaSettings {
    const settings = cinemaSettings(env);
    if (Buffer.byteLength(settings.jwtSecret) < 32)
        throw new Error('CINEMA_JWT_SECRET must contain at least 32 bytes');
    if (settings.jwtSecret === env.ADMIN_JWT_SECRET)
        throw new Error('CINEMA_JWT_SECRET must differ from ADMIN_JWT_SECRET');
    return settings;
}
export function cinemaSqlConfig(env: NodeJS.ProcessEnv = process.env): SqlConfig {
    const required = [
        'CINEMA_SQLSERVER_HOST',
        'CINEMA_SQLSERVER_DATABASE',
        'CINEMA_SQLSERVER_USER',
        'CINEMA_SQLSERVER_PASSWORD',
    ];
    const missing = required.filter((k) => !env[k]);
    if (missing.length) throw new Error(`Missing SQL Server configuration: ${missing.join(', ')}`);
    if (
        env.NODE_ENV === 'production' &&
        (env.CINEMA_SQLSERVER_TRUST_CERTIFICATE === 'true' ||
            env.CINEMA_SQLSERVER_ENCRYPT === 'false')
    )
        throw new Error('Production SQL Server requires encryption and certificate verification');
    const server = env.CINEMA_SQLSERVER_HOST;
    const database = env.CINEMA_SQLSERVER_DATABASE;
    const user = env.CINEMA_SQLSERVER_USER;
    const password = env.CINEMA_SQLSERVER_PASSWORD;
    if (!server || !database || !user || !password) {
        throw new Error(`Missing SQL Server configuration: ${missing.join(', ')}`);
    }
    return {
        server,
        database,
        user,
        password,
        port: integer(env.CINEMA_SQLSERVER_PORT, 1433, 1, 65535, 'CINEMA_SQLSERVER_PORT'),
        options: {
            encrypt: env.CINEMA_SQLSERVER_ENCRYPT !== 'false',
            trustServerCertificate: env.CINEMA_SQLSERVER_TRUST_CERTIFICATE === 'true',
            useUTC: true,
            abortTransactionOnError: true,
        },
        pool: { max: 20, min: 0, idleTimeoutMillis: 30000 },
        connectionTimeout: 10000,
        requestTimeout: 15000,
    };
}
