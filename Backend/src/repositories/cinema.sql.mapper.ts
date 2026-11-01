import type { AccountRow } from '../types/cinema.auth.types';
import type {
    BookingRow,
    BookingSeat,
    TicketRow,
    TransactionStepRow,
} from '../types/cinema.booking.types';
import type {
    CinemaRow,
    MovieRow,
    RoomRow,
    SeatRow,
    ShowtimeRow,
} from '../types/cinema.catalog.types';
import type { OutboxEvent } from '../types/cinema.jobs.types';
import type { PaymentRow } from '../types/cinema.payment.types';
import type {
    BookingStatusCount,
    HistorySeatRow,
    PaymentResultRow,
    PhysicalSeatRow,
} from '../types/cinema.repository.types';
import type { SqlRow, SqlScalar } from '../types/cinema.sql.types';

const bookingStates = [
    'CHO_THANH_TOAN',
    'DA_THANH_TOAN',
    'HOAN_TAT',
    'THAT_BAI',
    'HET_HAN',
    'DA_HUY',
    'CHO_HOAN_TIEN',
    'DA_HOAN_TIEN',
] as const;
const paymentStates = ['CHO', 'THANH_CONG', 'THAT_BAI', 'CHO_HOAN_TIEN', 'DA_HOAN_TIEN'] as const;

function invalid(column: string): never {
    throw new Error(`Invalid Cinema SQL result column: ${column}.`);
}

function text(row: SqlRow, column: string): string {
    const value = row[column];
    return typeof value === 'string' ? value : invalid(column);
}

function nullableText(row: SqlRow, column: string): string | null {
    return row[column] === null ? null : text(row, column);
}

function optionalText(row: SqlRow, column: string): string | undefined {
    return row[column] === undefined ? undefined : text(row, column);
}

function integer(row: SqlRow, column: string): number {
    const value = row[column];
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
        return invalid(column);
    }
    return value;
}

function id(row: SqlRow, column: string): number {
    const value = integer(row, column);
    return value > 0 && value <= 2147483647 ? value : invalid(column);
}

function optionalId(row: SqlRow, column: string): number | undefined {
    return row[column] === undefined ? undefined : id(row, column);
}

function count(row: SqlRow, column: string): number {
    const value = integer(row, column);
    return value >= 0 ? value : invalid(column);
}

function optionalCount(row: SqlRow, column: string): number | undefined {
    return row[column] === undefined ? undefined : count(row, column);
}

function money(row: SqlRow, column: string): number {
    const value = row[column];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return invalid(column);
    }
    return value;
}

function bit(row: SqlRow, column: string): boolean {
    const value = row[column];
    return typeof value === 'boolean' ? value : invalid(column);
}

function date(row: SqlRow, column: string): Date {
    const value = row[column];
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
        return invalid(column);
    }
    return value;
}

function nullableDate(row: SqlRow, column: string): Date | null {
    return row[column] === null ? null : date(row, column);
}

function optionalDate(row: SqlRow, column: string): Date | undefined {
    return row[column] === undefined ? undefined : date(row, column);
}

function state<T extends string>(value: SqlScalar, allowed: readonly T[], column: string): T {
    const result = allowed.find((candidate) => candidate === value);
    return result === undefined ? invalid(column) : result;
}

function bigIntId(row: SqlRow, column: string): string {
    const value = row[column];
    if (
        (typeof value !== 'string' && typeof value !== 'bigint' && typeof value !== 'number') ||
        (typeof value === 'number' && !Number.isSafeInteger(value))
    ) {
        return invalid(column);
    }
    const precise = String(value);
    if (!/^\d+$/.test(precise)) {
        return invalid(column);
    }
    const numeric = BigInt(precise);
    if (numeric < 1n || numeric > 9223372036854775807n) {
        return invalid(column);
    }
    return precise;
}

export function decodeAccount(row: SqlRow): AccountRow {
    return {
        id: id(row, 'id'),
        email: text(row, 'email'),
        mat_khau: text(row, 'mat_khau'),
        ho_ten: text(row, 'ho_ten'),
        dang_hoat_dong: bit(row, 'dang_hoat_dong'),
    };
}

export function decodeMovie(row: SqlRow): MovieRow {
    return {
        id: id(row, 'id'),
        ten_phim: text(row, 'ten_phim'),
        mo_ta: text(row, 'mo_ta'),
        the_loai: text(row, 'the_loai'),
        dao_dien: text(row, 'dao_dien'),
        thoi_luong: integer(row, 'thoi_luong'),
        ngay_khoi_chieu: date(row, 'ngay_khoi_chieu'),
        poster_url: text(row, 'poster_url'),
        trailer_url: nullableText(row, 'trailer_url'),
        trang_thai: state(row.trang_thai, ['DANG_CHIEU', 'NGUNG_CHIEU'], 'trang_thai'),
    };
}

export function decodeCinema(row: SqlRow): CinemaRow {
    return {
        id: id(row, 'id'),
        ten_cum_rap: text(row, 'ten_cum_rap'),
        dia_chi: text(row, 'dia_chi'),
        thanh_pho: text(row, 'thanh_pho'),
        dang_hoat_dong: bit(row, 'dang_hoat_dong'),
    };
}

export function decodeRoom(row: SqlRow): RoomRow {
    return {
        id: id(row, 'id'),
        id_cum_rap: id(row, 'id_cum_rap'),
        ten_phong: text(row, 'ten_phong'),
        dang_hoat_dong: bit(row, 'dang_hoat_dong'),
    };
}

export function decodePhysicalSeat(row: SqlRow): PhysicalSeatRow {
    return {
        id: id(row, 'id'),
        id_phong_chieu: id(row, 'id_phong_chieu'),
        hang_ghe: text(row, 'hang_ghe'),
        so_ghe: integer(row, 'so_ghe'),
        ten_ghe: text(row, 'ten_ghe'),
        loai_ghe: state(row.loai_ghe, ['THUONG', 'VIP'], 'loai_ghe'),
        phu_thu: money(row, 'phu_thu'),
    };
}

export function decodeShowtime(row: SqlRow): ShowtimeRow {
    return {
        id: id(row, 'id'),
        id_phim: id(row, 'id_phim'),
        id_phong_chieu: id(row, 'id_phong_chieu'),
        bat_dau_luc: date(row, 'bat_dau_luc'),
        ket_thuc_luc: date(row, 'ket_thuc_luc'),
        gia_co_ban: money(row, 'gia_co_ban'),
        trang_thai: state(row.trang_thai, ['MO_BAN', 'DONG'], 'trang_thai'),
        ten_phim: optionalText(row, 'ten_phim'),
        ten_phong: optionalText(row, 'ten_phong'),
        ten_cum_rap: optionalText(row, 'ten_cum_rap'),
        id_cum_rap: optionalId(row, 'id_cum_rap'),
    };
}

export function decodeSeat(row: SqlRow): SeatRow {
    return {
        id_ghe: id(row, 'id_ghe'),
        ten_ghe: text(row, 'ten_ghe'),
        hang_ghe: text(row, 'hang_ghe'),
        so_ghe: integer(row, 'so_ghe'),
        loai_ghe: state(row.loai_ghe, ['THUONG', 'VIP'], 'loai_ghe'),
        gia_ve: money(row, 'gia_ve'),
        trang_thai: state(row.trang_thai, ['TRONG', 'DANG_GIU', 'DA_BAN'], 'trang_thai'),
        het_han_luc: nullableDate(row, 'het_han_luc'),
    };
}

export function decodeBooking(row: SqlRow): BookingRow {
    return {
        id: id(row, 'id'),
        id_khach_hang: id(row, 'id_khach_hang'),
        id_suat_chieu: id(row, 'id_suat_chieu'),
        ma_don: text(row, 'ma_don'),
        tong_tien: money(row, 'tong_tien'),
        trang_thai: state(row.trang_thai, bookingStates, 'trang_thai'),
        het_han_luc: date(row, 'het_han_luc'),
        tao_luc: date(row, 'tao_luc'),
        ly_do_that_bai: nullableText(row, 'ly_do_that_bai'),
        replayed: row.replayed === undefined ? undefined : bit(row, 'replayed'),
        ten_phim: optionalText(row, 'ten_phim'),
        bat_dau_luc: optionalDate(row, 'bat_dau_luc'),
        ten_phong: optionalText(row, 'ten_phong'),
        ten_cum_rap: optionalText(row, 'ten_cum_rap'),
        last_payment_status:
            row.last_payment_status === undefined || row.last_payment_status === null
                ? row.last_payment_status
                : state(row.last_payment_status, paymentStates, 'last_payment_status'),
        ticket_count: optionalCount(row, 'ticket_count'),
    };
}

export function decodeBookingSeat(row: SqlRow): BookingSeat {
    return {
        id_ghe: id(row, 'id_ghe'),
        ten_ghe: text(row, 'ten_ghe'),
        gia_ve: money(row, 'gia_ve'),
    };
}

export function decodeHistorySeat(row: SqlRow): HistorySeatRow {
    return {
        ...decodeBookingSeat(row),
        id_don_hang: id(row, 'id_don_hang'),
    };
}

export function decodePayment(row: SqlRow): PaymentRow {
    return {
        id: id(row, 'id'),
        id_don_hang: id(row, 'id_don_hang'),
        ma_yeu_cau: text(row, 'ma_yeu_cau'),
        provider: text(row, 'provider'),
        so_tien: money(row, 'so_tien'),
        so_tien_gateway: row.so_tien_gateway === null ? null : money(row, 'so_tien_gateway'),
        don_vi_tien: state(row.don_vi_tien, ['VND'], 'don_vi_tien'),
        trang_thai: state(row.trang_thai, paymentStates, 'trang_thai'),
        ma_giao_dich_cong: nullableText(row, 'ma_giao_dich_cong'),
        ma_hoan_tien: nullableText(row, 'ma_hoan_tien'),
        thoi_gian_tao: date(row, 'thoi_gian_tao'),
        thoi_gian_cap_nhat: date(row, 'thoi_gian_cap_nhat'),
    };
}

export function decodePaymentResult(row: SqlRow): PaymentResultRow {
    return {
        trang_thai: state(row.trang_thai, paymentStates, 'trang_thai'),
    };
}

export function decodeTicket(row: SqlRow): TicketRow {
    return {
        id: id(row, 'id'),
        id_don_hang: id(row, 'id_don_hang'),
        id_suat_chieu: id(row, 'id_suat_chieu'),
        id_ghe: id(row, 'id_ghe'),
        ma_ve: text(row, 'ma_ve'),
        qr_token: text(row, 'qr_token'),
        gia_ve: money(row, 'gia_ve'),
        trang_thai: state(row.trang_thai, ['HOP_LE'], 'trang_thai'),
        ten_phim: text(row, 'ten_phim'),
        bat_dau_luc: date(row, 'bat_dau_luc'),
        ten_phong: text(row, 'ten_phong'),
        ten_cum_rap: text(row, 'ten_cum_rap'),
        ten_ghe: text(row, 'ten_ghe'),
    };
}

export function decodeTransactionStep(row: SqlRow): TransactionStepRow {
    return {
        id: bigIntId(row, 'id'),
        ten_buoc: text(row, 'ten_buoc'),
        hanh_dong: state(row.hanh_dong, ['THUC_HIEN', 'BU_TRU'], 'hanh_dong'),
        trang_thai: state(row.trang_thai, ['CHO', 'THANH_CONG', 'THAT_BAI'], 'trang_thai'),
        thong_diep: nullableText(row, 'thong_diep'),
        tao_luc: date(row, 'tao_luc'),
    };
}

export function decodeOutbox(row: SqlRow): OutboxEvent {
    const fields = {
        id: bigIntId(row, 'id'),
        event_key: text(row, 'event_key'),
        id_don_hang: id(row, 'id_don_hang'),
        trang_thai: state(row.trang_thai, ['CHO', 'THAT_BAI', 'HOAN_TAT'], 'trang_thai'),
        so_lan_thu: count(row, 'so_lan_thu'),
        so_lan_xu_ly: count(row, 'so_lan_xu_ly'),
        xu_ly_sau: date(row, 'xu_ly_sau'),
        lock_token: nullableText(row, 'lock_token'),
        locked_until: nullableDate(row, 'locked_until'),
        thong_diep_loi: nullableText(row, 'thong_diep_loi'),
    };
    const eventType = state(row.loai_su_kien, ['PHAT_HANH_VE', 'HOAN_TIEN'], 'loai_su_kien');
    if (eventType === 'PHAT_HANH_VE') {
        if (row.id_thanh_toan !== null) {
            return invalid('id_thanh_toan');
        }
        return { ...fields, loai_su_kien: eventType, id_thanh_toan: null };
    }
    return { ...fields, loai_su_kien: eventType, id_thanh_toan: id(row, 'id_thanh_toan') };
}

export function decodeTotal(row: SqlRow): { total: number } {
    return { total: count(row, 'total') };
}

export function decodeCount(row: SqlRow): { count: number } {
    return { count: count(row, 'count') };
}

export function decodeRevenue(row: SqlRow): { revenue: number } {
    return { revenue: money(row, 'revenue') };
}

export function decodeBigIntId(row: SqlRow): { id: string } {
    return { id: bigIntId(row, 'id') };
}

export function decodeBookingStatusCount(row: SqlRow): BookingStatusCount {
    return {
        status: state(row.status, bookingStates, 'status'),
        count: count(row, 'count'),
    };
}
