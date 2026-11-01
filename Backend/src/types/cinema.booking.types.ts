import type { PaymentStatus } from './cinema.payment.types';
export type TicketStatus = 'HOP_LE';
export type TransactionStatus = 'CHO' | 'THANH_CONG' | 'THAT_BAI';
export type TransactionAction = 'THUC_HIEN' | 'BU_TRU';
export type BookingState =
    | 'CHO_THANH_TOAN'
    | 'DA_THANH_TOAN'
    | 'HOAN_TAT'
    | 'THAT_BAI'
    | 'HET_HAN'
    | 'DA_HUY'
    | 'CHO_HOAN_TIEN'
    | 'DA_HOAN_TIEN';
export interface BookingRow {
    id: number;
    id_khach_hang: number;
    id_suat_chieu: number;
    ma_don: string;
    tong_tien: number;
    trang_thai: BookingState;
    het_han_luc: Date;
    tao_luc: Date;
    ly_do_that_bai: string | null;
    replayed?: boolean;
    ten_phim?: string;
    bat_dau_luc?: Date;
    ten_phong?: string;
    ten_cum_rap?: string;
    last_payment_status?: PaymentStatus | null;
    ticket_count?: number;
}
export interface BookingSeat {
    id_ghe: number;
    ten_ghe: string;
    gia_ve: number;
}
export interface TicketRow {
    id: number;
    id_don_hang: number;
    id_suat_chieu: number;
    id_ghe: number;
    ma_ve: string;
    qr_token: string;
    gia_ve: number;
    trang_thai: TicketStatus;
    ten_phim: string;
    bat_dau_luc: Date;
    ten_phong: string;
    ten_cum_rap: string;
    ten_ghe: string;
}
export interface TransactionStepRow {
    id: string;
    ten_buoc: string;
    hanh_dong: TransactionAction;
    trang_thai: TransactionStatus;
    thong_diep: string | null;
    tao_luc: Date;
}
export interface BookingDto {
    bookingId: number;
    bookingCode: string;
    showtimeId: number;
    selectedSeats: {
        seatId: number;
        seatName: string;
        price: number;
    }[];
    totalAmount: number;
    currency: 'VND';
    status: BookingState;
    expiresAt: Date;
    remainingSeconds: number;
    paymentStatus?: PaymentStatus | null;
    issuedTicketCount?: number;
    createdAt: Date;
    failureReason: string | null;
    movieTitle?: string;
    startsAt?: Date;
    roomName?: string;
    cinemaName?: string;
}
export interface TicketDto {
    id: number;
    bookingId: number;
    showtimeId: number;
    seatId: number;
    ticketCode: string;
    qrToken: string;
    price: number;
    currency: 'VND';
    status: TicketStatus;
    movieTitle: string;
    startsAt: Date;
    roomName: string;
    cinemaName: string;
    seatName: string;
}
