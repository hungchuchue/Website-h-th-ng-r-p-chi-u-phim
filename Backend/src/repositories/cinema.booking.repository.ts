import type { TransactionStepRow } from '../types/cinema.booking.types';
import {
    cinemaStore,
    sql,
    requireSqlRow,
    type CinemaStore,
    type Bind,
} from './cinema.store.repository';
import type {
    BookingRow,
    BookingSeat,
    CinemaIdentity,
    Page,
    PaymentRow,
    TicketRow,
} from '../types/cinema.types';
const bookingJoin =
    'FROM dbo.DON_HANG d JOIN dbo.SUAT_CHIEU sc ON sc.id=d.id_suat_chieu JOIN dbo.PHIM m ON m.id=sc.id_phim JOIN dbo.PHONG_CHIEU p ON p.id=sc.id_phong_chieu JOIN dbo.CUM_RAP c ON c.id=p.id_cum_rap';
const bookingSelect =
    'SELECT d.*,m.ten_phim,sc.bat_dau_luc,p.ten_phong,c.ten_cum_rap,(SELECT TOP(1) tt.trang_thai FROM dbo.THANH_TOAN tt WHERE tt.id_don_hang=d.id ORDER BY tt.id DESC) last_payment_status,(SELECT COUNT(*) FROM dbo.VE v WHERE v.id_don_hang=d.id) ticket_count';
const ticketJoin =
    'FROM dbo.VE v JOIN dbo.DON_HANG d ON d.id=v.id_don_hang JOIN dbo.SUAT_CHIEU sc ON sc.id=v.id_suat_chieu JOIN dbo.PHIM m ON m.id=sc.id_phim JOIN dbo.PHONG_CHIEU p ON p.id=sc.id_phong_chieu JOIN dbo.CUM_RAP c ON c.id=p.id_cum_rap JOIN dbo.GHE g ON g.id=v.id_ghe';
import type {
    BookingRepository,
    RepositoryPage,
    HistorySeatRow,
    PaymentResultRow,
    BookingStatusCount,
    BookingDashboard,
} from '../types/cinema.repository.types';
export type { BookingRepository } from '../types/cinema.repository.types';
import {
    decodeBooking,
    decodeBookingSeat,
    decodeTotal,
    decodeHistorySeat,
    decodePayment,
    decodePaymentResult,
    decodeTicket,
    decodeTransactionStep,
    decodeBookingStatusCount,
    decodeRevenue,
    decodeCount,
} from './cinema.sql.mapper';

export function createCinemaBookingRepository(db: CinemaStore = cinemaStore): BookingRepository {
    return {
        db,
        async hold(
            customerId: number,
            showtimeId: number,
            seats: number[],
            key: string,
            hash: string,
            minutes: number,
        ): Promise<BookingRow> {
            const tvp = new sql.Table('dbo.DanhSachGhe');
            tvp.columns.add('id_ghe', sql.Int, { nullable: false });
            for (const id of seats) tvp.rows.add(id);
            return requireSqlRow(
                await db.execute<BookingRow>('dbo.sp_tao_don_va_giu_ghe', decodeBooking, (r) =>
                    r
                        .input('id_khach_hang', sql.Int, customerId)
                        .input('id_suat_chieu', sql.Int, showtimeId)
                        .input('danh_sach_ghe', tvp)
                        .input('idempotency_key', sql.VarChar(128), key)
                        .input('request_hash', sql.Char(64), hash)
                        .input('so_phut_giu', sql.Int, minutes),
                ),
            );
        },
        async booking(id: number, identity: CinemaIdentity): Promise<BookingRow | undefined> {
            return (
                await db.query<BookingRow>(
                    `${bookingSelect} ${bookingJoin} WHERE d.id=@id AND(@admin=1 OR d.id_khach_hang=@customerId)`,
                    decodeBooking,
                    (r) =>
                        r
                            .input('id', sql.Int, id)
                            .input('admin', sql.Bit, identity.role === 'ADMIN')
                            .input('customerId', sql.Int, identity.id),
                )
            )[0];
        },
        async seats(id: number): Promise<BookingSeat[]> {
            return db.query<BookingSeat>(
                'SELECT ct.id_ghe,g.ten_ghe,ct.gia_ve FROM dbo.CHI_TIET_DON_HANG ct JOIN dbo.GHE g ON g.id=ct.id_ghe WHERE ct.id_don_hang=@id ORDER BY g.hang_ghe,g.so_ghe',
                decodeBookingSeat,
                (r) => r.input('id', sql.Int, id),
            );
        },
        async history(
            identity: CinemaIdentity,
            page: Page,
            status: string | undefined,
            admin: boolean = false,
        ): Promise<RepositoryPage<BookingRow>> {
            const bind: Bind = (r) =>
                r
                    .input('customerId', sql.Int, identity.id)
                    .input('admin', sql.Bit, admin && identity.role === 'ADMIN')
                    .input('status', sql.VarChar(24), status ?? null)
                    .input('offset', sql.Int, page.offset)
                    .input('limit', sql.Int, page.limit);
            const where =
                'WHERE(@admin=1 OR d.id_khach_hang=@customerId) AND(@status IS NULL OR d.trang_thai=@status)';
            const [items, count] = await Promise.all([
                db.query<BookingRow>(
                    `${bookingSelect} ${bookingJoin} ${where} ORDER BY d.tao_luc DESC,d.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
                    decodeBooking,
                    bind,
                ),
                db.query<{
                    total: number;
                }>(`SELECT COUNT(*) total FROM dbo.DON_HANG d ${where}`, decodeTotal, bind),
            ]);
            return { items, total: requireSqlRow(count).total };
        },
        async historySeats(ids: number[]): Promise<HistorySeatRow[]> {
            if (!ids.length) return [];
            return db.query<
                BookingSeat & {
                    id_don_hang: number;
                }
            >(
                'SELECT ct.id_don_hang,ct.id_ghe,g.ten_ghe,ct.gia_ve FROM dbo.CHI_TIET_DON_HANG ct JOIN dbo.GHE g ON g.id=ct.id_ghe WHERE ct.id_don_hang IN(SELECT CONVERT(INT,[value]) FROM OPENJSON(@ids)) ORDER BY ct.id_don_hang,g.hang_ghe,g.so_ghe',
                decodeHistorySeat,
                (r) => r.input('ids', sql.NVarChar(sql.MAX), JSON.stringify(ids)),
            );
        },
        async cancel(id: number, customerId: number): Promise<void> {
            await db.executeCommand('dbo.sp_huy_don_chua_thanh_toan', (r) =>
                r.input('id_don_hang', sql.Int, id).input('id_khach_hang', sql.Int, customerId),
            );
        },
        async startPayment(
            id: number,
            customerId: number,
            key: string,
            provider: string,
        ): Promise<PaymentRow> {
            return requireSqlRow(
                await db.execute<PaymentRow>('dbo.sp_bat_dau_thanh_toan', decodePayment, (r) =>
                    r
                        .input('id_don_hang', sql.Int, id)
                        .input('id_khach_hang', sql.Int, customerId)
                        .input('idempotency_key', sql.VarChar(128), key)
                        .input('provider', sql.VarChar(32), provider),
                ),
            );
        },
        async paymentByReference(reference: string): Promise<PaymentRow | undefined> {
            return (
                await db.query<PaymentRow>(
                    'SELECT * FROM dbo.THANH_TOAN WHERE ma_yeu_cau=@reference',
                    decodePayment,
                    (r) => r.input('reference', sql.VarChar(64), reference),
                )
            )[0];
        },
        async payment(id: number): Promise<PaymentRow | undefined> {
            return (
                await db.query<PaymentRow>(
                    'SELECT * FROM dbo.THANH_TOAN WHERE id=@id',
                    decodePayment,
                    (r) => r.input('id', sql.Int, id),
                )
            )[0];
        },
        async payments(id: number): Promise<PaymentRow[]> {
            return db.query<PaymentRow>(
                'SELECT * FROM dbo.THANH_TOAN WHERE id_don_hang=@id ORDER BY id DESC',
                decodePayment,
                (r) => r.input('id', sql.Int, id),
            );
        },
        async paymentResult(
            reference: string,
            success: boolean,
            transaction: string,
            amount: number,
            provider: string,
        ): Promise<PaymentResultRow[]> {
            return db.execute<{
                trang_thai: PaymentRow['trang_thai'];
            }>('dbo.sp_xu_ly_ket_qua_thanh_toan', decodePaymentResult, (r) =>
                r
                    .input('ma_yeu_cau', sql.VarChar(64), reference)
                    .input('thanh_cong', sql.Bit, success)
                    .input('ma_giao_dich_cong', sql.VarChar(128), transaction)
                    .input('so_tien_gateway', sql.Decimal(18, 2), amount)
                    .input('provider', sql.VarChar(32), provider),
            );
        },
        async unknownPayment(id: number): Promise<void> {
            await db.queryCommand(
                "INSERT dbo.BUOC_GIAO_DICH(id_don_hang,ten_buoc,trang_thai,thong_diep) VALUES(@id,'THANH_TOAN','CHO',N'Verified UNKNOWN payment result: pending reconciliation, not treated as failure')",
                (r) => r.input('id', sql.Int, id),
            );
        },
        async issue(id: number): Promise<void> {
            await db.executeCommand('dbo.sp_phat_hanh_ve', (r) =>
                r.input('id_don_hang', sql.Int, id),
            );
        },
        async expire(): Promise<void> {
            await db.executeCommand('dbo.sp_giai_phong_ghe_het_han');
        },
        async confirmRefund(id: number, reference: string, amount: number): Promise<void> {
            await db.executeCommand('dbo.sp_xac_nhan_hoan_tien', (r) =>
                r
                    .input('id_thanh_toan', sql.Int, id)
                    .input('ma_hoan_tien', sql.VarChar(128), reference)
                    .input('so_tien_hoan', sql.Decimal(18, 2), amount),
            );
        },
        async tickets(id: number): Promise<TicketRow[]> {
            return db.query<TicketRow>(
                `SELECT v.*,m.ten_phim,sc.bat_dau_luc,p.ten_phong,c.ten_cum_rap,g.ten_ghe ${ticketJoin} WHERE v.id_don_hang=@id ORDER BY v.id`,
                decodeTicket,
                (r) => r.input('id', sql.Int, id),
            );
        },
        async ticket(id: number, identity: CinemaIdentity): Promise<TicketRow | undefined> {
            return (
                await db.query<TicketRow>(
                    `SELECT v.*,m.ten_phim,sc.bat_dau_luc,p.ten_phong,c.ten_cum_rap,g.ten_ghe ${ticketJoin} WHERE v.id=@id AND(@admin=1 OR d.id_khach_hang=@customerId)`,
                    decodeTicket,
                    (r) =>
                        r
                            .input('id', sql.Int, id)
                            .input('admin', sql.Bit, identity.role === 'ADMIN')
                            .input('customerId', sql.Int, identity.id),
                )
            )[0];
        },
        async steps(id: number): Promise<TransactionStepRow[]> {
            return db.query<TransactionStepRow>(
                'SELECT * FROM dbo.BUOC_GIAO_DICH WHERE id_don_hang=@id ORDER BY tao_luc,id',
                decodeTransactionStep,
                (r) => r.input('id', sql.Int, id),
            );
        },
        async dashboard(): Promise<BookingDashboard> {
            const [counts, revenue, tickets, outbox] = await Promise.all([
                db.query<BookingStatusCount>(
                    'SELECT trang_thai status,COUNT(*) count FROM dbo.DON_HANG GROUP BY trang_thai',
                    decodeBookingStatusCount,
                ),
                db.query<{
                    revenue: number;
                }>(
                    "SELECT COALESCE(SUM(so_tien),0) revenue FROM dbo.THANH_TOAN WHERE trang_thai='THANH_CONG'",
                    decodeRevenue,
                ),
                db.query<{
                    count: number;
                }>('SELECT COUNT(*) count FROM dbo.VE', decodeCount),
                db.query<{
                    count: number;
                }>(
                    "SELECT COUNT(*) count FROM dbo.OUTBOX_SU_KIEN WHERE trang_thai='THAT_BAI'",
                    decodeCount,
                ),
            ]);
            return {
                bookingsByStatus: counts,
                revenue: requireSqlRow(revenue).revenue,
                currency: 'VND',
                issuedTickets: requireSqlRow(tickets).count,
                failedOutboxEvents: requireSqlRow(outbox).count,
            };
        },
    };
}

export const cinemaBookingRepository: BookingRepository = createCinemaBookingRepository();
