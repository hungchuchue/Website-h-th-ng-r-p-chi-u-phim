export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
    [key: string]: JsonValue | undefined;
}
export type CinemaInput = JsonValue | undefined;
export interface CinemaQuery {
    [key: string]: CinemaInput;
}
export interface RegisterBody extends JsonObject {
    email: string;
    password: string;
    displayName?: string;
}
export interface LoginBody extends JsonObject {
    email: string;
    password: string;
    accountType?: 'CUSTOMER' | 'ADMIN';
}
export interface HoldBody extends JsonObject {
    showtimeId: number;
    seatIds: number[];
}
export interface PaymentBody extends JsonObject {
    provider?: string;
}
export interface MovieBody extends JsonObject {
    title: string;
    description: string;
    genres: string;
    director: string;
    duration: number;
    releaseDate: string;
    posterUrl: string;
    trailerUrl?: string | null;
    status?: 'DANG_CHIEU' | 'NGUNG_CHIEU';
}
export interface PhysicalSeatBody extends JsonObject {
    row: string;
    number: number;
    name?: string;
    type?: 'THUONG' | 'VIP';
    surcharge?: number;
}
export interface RoomBody extends JsonObject {
    cinemaId: number;
    name: string;
    seats: PhysicalSeatBody[];
}
export interface ShowtimeBody extends JsonObject {
    movieId: number;
    roomId: number;
    startsAt: string;
    basePrice: number;
}
export interface CinemaBody extends JsonObject {
    name: string;
    address: string;
    city: string;
}
export type CinemaFailure = Error | CinemaInput;
