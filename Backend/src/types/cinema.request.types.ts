import type { CinemaIdentity } from './cinema.auth.types';
export interface CinemaParams {
    [key: string]: string;
}
export interface PaginationData {
    page: number;
    limit: number;
    total: number;
}
declare global {
    namespace Express {
        interface Request {
            cinemaAuth?: CinemaIdentity;
            correlationId?: string;
        }
    }
}
