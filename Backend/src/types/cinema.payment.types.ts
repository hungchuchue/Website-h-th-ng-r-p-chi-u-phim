import type { CinemaInput, JsonObject } from './cinema.input.types';
export type PaymentStatus = 'CHO' | 'THANH_CONG' | 'THAT_BAI' | 'CHO_HOAN_TIEN' | 'DA_HOAN_TIEN';
export interface PaymentRow {
    id: number;
    id_don_hang: number;
    ma_yeu_cau: string;
    provider: string;
    so_tien: number;
    so_tien_gateway: number | null;
    don_vi_tien: string;
    trang_thai: 'CHO' | 'THANH_CONG' | 'THAT_BAI' | 'CHO_HOAN_TIEN' | 'DA_HOAN_TIEN';
    ma_giao_dich_cong: string | null;
    ma_hoan_tien: string | null;
    thoi_gian_tao: Date;
    thoi_gian_cap_nhat: Date;
}
export interface PaymentCallback extends JsonObject {
    bookingId: number;
    paymentReference: string;
    transactionId: string;
    amount: number;
    currency: 'VND';
    status: 'SUCCESS' | 'FAILED' | 'UNKNOWN';
    timestamp: number;
}
export interface RefundResult {
    verified: boolean;
    reference: string;
    amount: number;
    status: 'SUCCESS' | 'UNKNOWN';
}
export interface PaymentGateway {
    readonly name: string;
    createPayment(payment: PaymentRow): {
        provider: string;
        paymentReference: string;
        simulationRequired: boolean;
        paymentUrl: string | null;
    };
    verifyCallback(body: CinemaInput, signature: string | undefined): PaymentCallback;
    refund(payment: PaymentRow, eventKey: string): Promise<RefundResult>;
}
export interface PaymentDto {
    id: number;
    bookingId: number;
    paymentReference: string;
    provider: string;
    amount: number;
    receivedAmount: number | null;
    currency: string;
    status: PaymentStatus;
    transactionId: string | null;
    refundReference: string | null;
    createdAt: Date;
    updatedAt: Date;
}
