import sql from 'mssql';
import { cinemaSqlConfig } from './cinema';
let connection: Promise<sql.ConnectionPool> | undefined;
export function getCinemaPool(): Promise<sql.ConnectionPool> {
    if (!connection) {
        const pool = new sql.ConnectionPool(cinemaSqlConfig());
        pool.on('error', () =>
            console.error('[Cinema] SQL Server pool error; connection details omitted'),
        );
        connection = pool.connect().catch(async (error) => {
            connection = undefined;
            await pool.close().catch(() => {});
            throw error;
        });
    }
    return connection;
}
export async function closeCinemaPool(): Promise<void> {
    const current = connection;
    connection = undefined;
    if (current) await (await current).close();
}
export { sql };
