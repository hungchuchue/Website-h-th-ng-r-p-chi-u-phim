export type MovieStatus = 'DANG_CHIEU' | 'NGUNG_CHIEU';
export type ShowtimeStatus = 'MO_BAN' | 'DONG';
export type SeatType = 'THUONG' | 'VIP';
export type SeatStatus = 'TRONG' | 'DANG_GIU' | 'DA_BAN';
export interface MovieRow {
    id: number;
    ten_phim: string;
    mo_ta: string;
    the_loai: string;
    dao_dien: string;
    thoi_luong: number;
    ngay_khoi_chieu: Date;
    poster_url: string;
    trailer_url: string | null;
    trang_thai: MovieStatus;
}
export interface CinemaRow {
    id: number;
    ten_cum_rap: string;
    dia_chi: string;
    thanh_pho: string;
    dang_hoat_dong: boolean;
}
export interface RoomRow {
    id: number;
    id_cum_rap: number;
    ten_phong: string;
    dang_hoat_dong: boolean;
}
export interface ShowtimeRecord {
    id: number;
    id_phim: number;
    id_phong_chieu: number;
    bat_dau_luc: Date;
    ket_thuc_luc: Date;
    gia_co_ban: number;
    trang_thai: string;
    ten_phim?: string;
    ten_phong?: string;
    ten_cum_rap?: string;
    id_cum_rap?: number;
}
export interface SeatRow {
    id_ghe: number;
    ten_ghe: string;
    hang_ghe: string;
    so_ghe: number;
    loai_ghe: SeatType;
    gia_ve: number;
    trang_thai: SeatStatus;
    het_han_luc: Date | null;
}
export interface ShowtimeRow extends Omit<ShowtimeRecord, 'trang_thai'> {
    trang_thai: ShowtimeStatus;
}
export interface MovieInput {
    title: string;
    description: string;
    genres: string;
    director: string;
    duration: number;
    releaseDate: string;
    posterUrl: string;
    trailerUrl: string | null;
    status: MovieStatus;
}
export interface PhysicalSeat {
    row: string;
    number: number;
    name: string;
    type: SeatType;
    surcharge: number;
}
export interface MovieDto extends MovieInput {
    id: number;
}
export interface ShowtimeDto {
    id: number;
    movieId: number;
    roomId: number;
    cinemaId?: number;
    startsAt: Date;
    endsAt: Date;
    basePrice: number;
    currency: 'VND';
    status: ShowtimeStatus;
    movieTitle?: string;
    roomName?: string;
    cinemaName?: string;
}
