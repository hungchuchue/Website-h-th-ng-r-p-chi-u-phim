export type CinemaRole = 'CUSTOMER' | 'ADMIN';
export interface CinemaIdentity {
    id: number;
    role: CinemaRole;
}
export interface AccountRow {
    id: number;
    email: string;
    mat_khau: string;
    ho_ten: string;
    dang_hoat_dong: boolean;
}
export interface CinemaJwtClaims {
    role: CinemaRole;
    userId: number;
    type: 'access';
    sub: string;
}
export interface AccountDto {
    id: number;
    email: string;
    displayName: string;
    role: CinemaRole;
}
export interface AuthDto {
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
    user: AccountDto;
}
