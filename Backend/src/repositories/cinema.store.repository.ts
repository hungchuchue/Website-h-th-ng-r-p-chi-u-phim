import sql from 'mssql';
import { getCinemaPool } from '../config/cinema.database';
import type { Bind, CinemaStore, SqlRow, SqlRowDecoder } from '../types/cinema.sql.types';

export type { Bind, CinemaStore, SqlRow, SqlRowDecoder } from '../types/cinema.sql.types';

export function requireSqlRow<T>(rows: readonly T[]): T {
    const row = rows[0];
    if (row === undefined) {
        throw new Error('Expected Cinema SQL result row was missing.');
    }
    return row;
}

export function createCinemaStore(
    pool: () => Promise<sql.ConnectionPool> = getCinemaPool,
): CinemaStore {
    return {
        pool,
        async query<T>(
            statement: string,
            decode: SqlRowDecoder<T>,
            bind: Bind = (request) => request,
        ): Promise<T[]> {
            const result = await bind((await pool()).request()).query<SqlRow>(statement);
            return (result.recordset || []).map(decode);
        },
        async execute<T>(
            procedure: string,
            decode: SqlRowDecoder<T>,
            bind: Bind = (request) => request,
        ): Promise<T[]> {
            const result = await bind((await pool()).request()).execute<SqlRow>(procedure);
            return (result.recordset || []).map(decode);
        },
        async queryCommand(statement: string, bind: Bind = (request) => request): Promise<void> {
            await bind((await pool()).request()).query<SqlRow>(statement);
        },
        async executeCommand(procedure: string, bind: Bind = (request) => request): Promise<void> {
            await bind((await pool()).request()).execute<SqlRow>(procedure);
        },
    };
}

export const cinemaStore: CinemaStore = createCinemaStore();
export { sql };
