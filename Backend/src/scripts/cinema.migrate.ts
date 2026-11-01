import { loadEnvironment, reportCliError } from './cinema.common';
import { getCinemaPool, closeCinemaPool } from '../config/cinema.database';
import { migrationStatus, runMigrations } from '../utils/cinema.migrations';
async function main(): Promise<void> {
    loadEnvironment();
    const command = process.argv[2];
    if (!['up', 'status'].includes(command || ''))
        throw new Error('Invalid migration command: use up or status');
    const pool = await getCinemaPool();
    if (command === 'up') await runMigrations(pool);
    const status = await migrationStatus(pool);
    console.log(JSON.stringify(status, null, 2));
    if (status.drift || status.migrations.some((m) => m.status === 'checksum_mismatch'))
        process.exitCode = 1;
}
main()
    .catch(reportCliError)
    .finally(() => closeCinemaPool().catch(() => {}));
