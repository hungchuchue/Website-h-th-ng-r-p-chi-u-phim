import {
    cinemaStore,
    sql,
    requireSqlRow,
    type CinemaStore,
    type Bind,
} from './cinema.store.repository';
import type { OutboxEvent, Page } from '../types/cinema.types';
import type { OutboxRepository, RepositoryPage } from '../types/cinema.repository.types';
export type { OutboxRepository } from '../types/cinema.repository.types';
import { decodeOutbox, decodeBigIntId, decodeTotal } from './cinema.sql.mapper';

export function createCinemaOutboxRepository(db: CinemaStore = cinemaStore): OutboxRepository {
    return {
        db,
        async claim(
            eventKey?: string,
            allowRefund: boolean = true,
        ): Promise<OutboxEvent | undefined> {
            // READCOMMITTEDLOCK also permits READPAST on databases with READ_COMMITTED_SNAPSHOT enabled.
            return (
                await db.query<OutboxEvent>(
                    `;WITH candidate AS (
   SELECT TOP(1) * FROM dbo.OUTBOX_SU_KIEN WITH(UPDLOCK,READPAST,READCOMMITTEDLOCK)
   WHERE trang_thai IN('CHO','THAT_BAI') AND so_lan_xu_ly<5 AND xu_ly_sau<=SYSUTCDATETIME()
   AND(locked_until IS NULL OR locked_until<=SYSUTCDATETIME()) AND(@key IS NULL OR event_key=@key)
   AND(@allowRefund=1 OR loai_su_kien='PHAT_HANH_VE') ORDER BY xu_ly_sau,id
  ) UPDATE candidate SET lock_token=NEWID(),locked_until=DATEADD(SECOND,60,SYSUTCDATETIME()),so_lan_xu_ly=so_lan_xu_ly+1,cap_nhat_luc=SYSUTCDATETIME() OUTPUT inserted.*;`,
                    decodeOutbox,
                    (r) =>
                        r
                            .input('key', sql.VarChar(80), eventKey ?? null)
                            .input('allowRefund', sql.Bit, allowRefund),
                )
            )[0];
        },
        async heartbeat(event: OutboxEvent): Promise<boolean> {
            const rows = await db.query<{
                id: string;
            }>(
                "UPDATE dbo.OUTBOX_SU_KIEN SET locked_until=DATEADD(SECOND,60,SYSUTCDATETIME()) OUTPUT inserted.id WHERE id=@id AND lock_token=@token AND locked_until>SYSUTCDATETIME() AND trang_thai<>'HOAN_TAT'",
                decodeBigIntId,
                (r) =>
                    r
                        .input('id', sql.BigInt, event.id)
                        .input('token', sql.UniqueIdentifier, event.lock_token),
            );
            return rows.length === 1;
        },
        async retry(event: OutboxEvent, delaySeconds: number): Promise<boolean> {
            const rows = await db.query<{
                id: string;
            }>(
                `UPDATE dbo.OUTBOX_SU_KIEN SET trang_thai='THAT_BAI',xu_ly_sau=DATEADD(SECOND,@delay,SYSUTCDATETIME()),lock_token=NULL,locked_until=NULL,
   thong_diep_loi=COALESCE(thong_diep_loi,N'Worker operation failed or provider result is unknown; reconciliation/retry required'),cap_nhat_luc=SYSUTCDATETIME()
   OUTPUT inserted.id WHERE id=@id AND lock_token=@token AND locked_until>SYSUTCDATETIME() AND trang_thai<>'HOAN_TAT'`,
                decodeBigIntId,
                (r) =>
                    r
                        .input('delay', sql.Int, delaySeconds)
                        .input('id', sql.BigInt, event.id)
                        .input('token', sql.UniqueIdentifier, event.lock_token),
            );
            return rows.length === 1;
        },
        async list(page: Page, status?: string): Promise<RepositoryPage<OutboxEvent>> {
            const bind: Bind = (r) =>
                r
                    .input('status', sql.VarChar(16), status ?? null)
                    .input('offset', sql.Int, page.offset)
                    .input('limit', sql.Int, page.limit);
            const [items, count] = await Promise.all([
                db.query<OutboxEvent>(
                    'SELECT * FROM dbo.OUTBOX_SU_KIEN WHERE(@status IS NULL OR trang_thai=@status) ORDER BY id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY',
                    decodeOutbox,
                    bind,
                ),
                db.query<{
                    total: number;
                }>(
                    'SELECT COUNT(*) total FROM dbo.OUTBOX_SU_KIEN WHERE(@status IS NULL OR trang_thai=@status)',
                    decodeTotal,
                    bind,
                ),
            ]);
            return { items, total: requireSqlRow(count).total };
        },
    };
}

export const cinemaOutboxRepository: OutboxRepository = createCinemaOutboxRepository();
