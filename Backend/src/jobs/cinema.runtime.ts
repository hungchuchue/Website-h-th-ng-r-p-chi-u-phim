import { createCinemaBookingRepository } from '../repositories/cinema.booking.repository';
import { cinemaEnabled, cinemaSettings, requireCinemaJwt } from '../config/cinema';
import { getCinemaPool, closeCinemaPool } from '../config/cinema.database';

import { cinemaOutboxProcessor } from './cinema.outbox.worker';
import { migrationStatus } from '../utils/cinema.migrations';
let timers: NodeJS.Timeout[] = [];
const running = new Set<Promise<void>>();
let started = false;
function repeat(milliseconds: number, operation: () => Promise<void>): void {
    let busy = false;
    const tick = (): void => {
        if (busy || !started) return;
        busy = true;
        const work = operation()
            .catch(() =>
                console.error('[Cinema] Background operation failed; next poll will retry'),
            )
            .finally(() => {
                busy = false;
                running.delete(work);
            });
        running.add(work);
    };
    const timer = setInterval(tick, milliseconds);
    timer.unref();
    timers.push(timer);
    tick();
}
export async function startCinemaRuntime(): Promise<void> {
    if (!cinemaEnabled() || started) return;
    try {
        requireCinemaJwt();
        const pool = await getCinemaPool();
        const status = await migrationStatus(pool);
        if (
            status.drift ||
            status.objects.missing.length ||
            status.migrations.some((m) => m.status !== 'applied')
        )
            throw new Error(
                'SQL Server schema or migration history is incomplete/drifted. Run cinema:db:status and review migrations explicitly.',
            );
        started = true;
        if (cinemaSettings().workers) {
            const bookings = createCinemaBookingRepository();
            repeat(10000, () => bookings.expire());
            repeat(2000, async () => {
                for (let n = 0; n < 20 && started; n++) {
                    if (!(await cinemaOutboxProcessor.processOne())) break;
                }
            });
        }
        console.log('[Cinema] SQL Server connected; Cinema routes enabled');
    } catch (error) {
        started = false;
        const message =
            error instanceof Error &&
            /^(Missing SQL Server|CINEMA_|SQL Server schema|Production SQL Server)/.test(
                error.message,
            )
                ? error.message
                : 'SQL Server initialization failed. Check cinema:db:status and connection/metadata permissions; connection details omitted.';
        console.error('[Cinema]', message);
        await closeCinemaPool().catch(() => {});
        throw error;
    }
}
export async function stopCinemaRuntime(): Promise<void> {
    started = false;
    for (const timer of timers) clearInterval(timer);
    timers = [];
    await Promise.allSettled([...running]);
    await closeCinemaPool().catch(() =>
        console.error('[Cinema] SQL Server pool shutdown failed; details omitted'),
    );
}
