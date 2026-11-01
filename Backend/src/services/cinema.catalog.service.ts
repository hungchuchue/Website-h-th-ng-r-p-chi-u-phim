import {
    cinemaCatalogRepository,
    type CatalogRepository,
    type MovieInput,
    type PhysicalSeat,
} from '../repositories/cinema.catalog.repository';
import type {
    PaginatedResult,
    CinemaDto,
    CreatedCinemaDto,
    RoomDto,
    CreatedRoomDto,
    SeatMapDto,
} from '../types/cinema.service.types';
import type { CinemaBody } from '../types/cinema.input.types';
import type { MovieDto, ShowtimeDto } from '../types/cinema.catalog.types';
import type { CinemaInput, CinemaQuery } from '../types/cinema.input.types';
import { AppError } from '../utils/logger';
import type { MovieRow, ShowtimeRecord } from '../types/cinema.types';
import * as v from '../utils/cinema.validation';
export function found<T>(row: T | undefined): T {
    if (row === undefined) throw new AppError(404, 'NOT_FOUND', 'Resource not found.');
    return row;
}
export function movieDto(m: MovieRow): MovieDto {
    return {
        id: m.id,
        title: m.ten_phim,
        description: m.mo_ta,
        genres: m.the_loai,
        director: m.dao_dien,
        duration: m.thoi_luong,
        releaseDate: new Date(m.ngay_khoi_chieu).toISOString().slice(0, 10),
        posterUrl: m.poster_url,
        trailerUrl: m.trailer_url,
        status: m.trang_thai,
    };
}
export function showtimeDto(s: ShowtimeRecord): ShowtimeDto {
    return {
        id: s.id,
        movieId: s.id_phim,
        roomId: s.id_phong_chieu,
        cinemaId: s.id_cum_rap,
        startsAt: s.bat_dau_luc,
        endsAt: s.ket_thuc_luc,
        basePrice: s.gia_co_ban,
        currency: 'VND',
        status: v.choice(s.trang_thai, ['MO_BAN', 'DONG'] as const, 'status'),
        movieTitle: s.ten_phim,
        roomName: s.ten_phong,
        cinemaName: s.ten_cum_rap,
    };
}

export interface CatalogService {
    readonly repo: CatalogRepository;
    movies(query: CinemaQuery): Promise<PaginatedResult<MovieDto>>;
    movie(id: number): Promise<MovieDto>;
    cinemas(): Promise<CinemaDto[]>;
    rooms(id: number): Promise<RoomDto[]>;
    showtimes(query: CinemaQuery): Promise<PaginatedResult<ShowtimeDto>>;
    showtime(id: number): Promise<ShowtimeDto>;
    seats(id: number): Promise<SeatMapDto>;
    createMovie(body: CinemaInput): Promise<MovieDto>;
    updateMovie(id: number, body: CinemaInput): Promise<MovieDto>;
    createCinema(body: CinemaInput): Promise<CreatedCinemaDto>;
    createRoom(body: CinemaInput): Promise<CreatedRoomDto>;
    createShowtime(body: CinemaInput): Promise<ShowtimeDto>;
}

function movieInput(body: CinemaInput, patch: boolean = false): Partial<MovieInput> {
    const keys = [
            'title',
            'description',
            'genres',
            'director',
            'duration',
            'releaseDate',
            'posterUrl',
            'trailerUrl',
            'status',
        ] as const,
        data = v.object(body, keys),
        result: Partial<MovieInput> = {};
    if (patch && !Object.keys(data).length)
        return v.invalid('At least one movie field is required.');
    for (const key of keys) {
        if (patch && data[key] === undefined) continue;
        switch (key) {
            case 'title':
                result.title = v.text(data.title, 'title', 200);
                break;
            case 'description':
                result.description = v.text(data.description, 'description', 20000);
                break;
            case 'genres':
                result.genres = v.text(data.genres, 'genres', 200);
                break;
            case 'director':
                result.director = v.text(data.director, 'director', 200);
                break;
            case 'duration': {
                const d = v.positiveId(data.duration, 'duration');
                if (d > 600) return v.invalid('duration cannot exceed 600 minutes.');
                result.duration = d;
                break;
            }
            case 'releaseDate':
                result.releaseDate =
                    v.calendarDate(data.releaseDate) ?? v.invalid('releaseDate is required.');
                break;
            case 'posterUrl':
                result.posterUrl = v.url(data.posterUrl, 'posterUrl');
                break;
            case 'trailerUrl':
                result.trailerUrl = v.url(data.trailerUrl, 'trailerUrl', true);
                break;
            case 'status':
                result.status =
                    data.status === undefined
                        ? 'DANG_CHIEU'
                        : v.choice(data.status, ['DANG_CHIEU', 'NGUNG_CHIEU'] as const, 'status');
                break;
        }
    }
    return result;
}

function completeMovieInput(body: CinemaInput): MovieInput {
    const d = movieInput(body);
    if (
        d.title === undefined ||
        d.description === undefined ||
        d.genres === undefined ||
        d.director === undefined ||
        d.duration === undefined ||
        d.releaseDate === undefined ||
        d.posterUrl === undefined ||
        d.trailerUrl === undefined ||
        d.status === undefined
    )
        return v.invalid('Missing movie field.');
    return {
        title: d.title,
        description: d.description,
        genres: d.genres,
        director: d.director,
        duration: d.duration,
        releaseDate: d.releaseDate,
        posterUrl: d.posterUrl,
        trailerUrl: d.trailerUrl,
        status: d.status,
    };
}

export function createCinemaCatalogService(
    repo: CatalogRepository = cinemaCatalogRepository,
): CatalogService {
    const service: CatalogService = {
        repo,

        async movies(query: CinemaQuery): Promise<PaginatedResult<MovieDto>> {
            const page = v.pagination(query),
                status =
                    query.status === undefined
                        ? 'DANG_CHIEU'
                        : v.choice(query.status, ['DANG_CHIEU', 'NGUNG_CHIEU'], 'status'),
                search = query.search === undefined ? '' : v.text(query.search, 'search', 200);
            const result = await repo.movies(page, status, search);
            return {
                items: result.items.map(movieDto),
                pagination: { page: page.page, limit: page.limit, total: result.total },
            };
        },

        async movie(id: number): Promise<MovieDto> {
            return movieDto(found(await repo.movie(id)));
        },

        async cinemas(): Promise<CinemaDto[]> {
            return (await repo.cinemas()).map((c) => ({
                id: c.id,
                name: c.ten_cum_rap,
                address: c.dia_chi,
                city: c.thanh_pho,
                active: c.dang_hoat_dong,
            }));
        },

        async rooms(id: number): Promise<RoomDto[]> {
            found(await repo.cinema(id));
            const [rooms, seats] = await Promise.all([repo.rooms(id), repo.physicalSeats(id)]);
            return rooms.map((p) => ({
                id: p.id,
                cinemaId: p.id_cum_rap,
                name: p.ten_phong,
                active: p.dang_hoat_dong,
                seats: seats
                    .filter((g) => g.id_phong_chieu === p.id)
                    .map((g) => ({
                        id: g.id,
                        row: g.hang_ghe,
                        number: g.so_ghe,
                        name: g.ten_ghe,
                        type: g.loai_ghe,
                        surcharge: g.phu_thu,
                    })),
            }));
        },

        async showtimes(query: CinemaQuery): Promise<PaginatedResult<ShowtimeDto>> {
            const page = v.pagination(query),
                filters = {
                    movieId:
                        query.movieId === undefined
                            ? undefined
                            : v.positiveId(query.movieId, 'movieId'),
                    cinemaId:
                        query.cinemaId === undefined
                            ? undefined
                            : v.positiveId(query.cinemaId, 'cinemaId'),
                    date: v.calendarDate(query.date),
                };
            const result = await repo.showtimes(filters, page);
            return {
                items: result.items.map(showtimeDto),
                pagination: { page: page.page, limit: page.limit, total: result.total },
            };
        },

        async showtime(id: number): Promise<ShowtimeDto> {
            return showtimeDto(found(await repo.showtime(id)));
        },

        async seats(id: number): Promise<SeatMapDto> {
            const showtime = found(await repo.showtime(id));
            const seats = await repo.seats(id);
            return {
                showtime: showtimeDto(showtime),
                serverTime: new Date().toISOString(),
                seats: seats.map((g) => ({
                    seatId: g.id_ghe,
                    seatName: g.ten_ghe,
                    row: g.hang_ghe,
                    number: g.so_ghe,
                    type: g.loai_ghe,
                    price: g.gia_ve,
                    status: g.trang_thai,
                    expiresAt: g.het_han_luc,
                })),
            };
        },

        async createMovie(body: CinemaInput): Promise<MovieDto> {
            return movieDto(await repo.createMovie(completeMovieInput(body)));
        },

        async updateMovie(id: number, body: CinemaInput): Promise<MovieDto> {
            return movieDto(found(await repo.updateMovie(id, movieInput(body, true))));
        },

        async createCinema(body: CinemaInput): Promise<CreatedCinemaDto> {
            const d = v.object(body, ['name', 'address', 'city']);
            const request: CinemaBody = {
                name: v.text(d.name, 'name', 200),
                address: v.text(d.address, 'address', 500),
                city: v.text(d.city, 'city', 120),
            };
            const row = await repo.createCinema(request.name, request.address, request.city);
            return {
                id: row.id,
                name: row.ten_cum_rap,
                address: row.dia_chi,
                city: row.thanh_pho,
            };
        },

        async createRoom(body: CinemaInput): Promise<CreatedRoomDto> {
            const d = v.object(body, ['cinemaId', 'name', 'seats']);
            const cinemaId = v.positiveId(d.cinemaId, 'cinemaId'),
                name = v.text(d.name, 'name', 100);
            if (!Array.isArray(d.seats) || !d.seats.length || d.seats.length > 1000)
                return v.invalid('seats must contain 1-1000 physical seats.');
            const positions = new Set<string>(),
                names = new Set<string>();
            const seats: PhysicalSeat[] = d.seats.map((raw) => {
                const s = v.object(raw, ['row', 'number', 'name', 'type', 'surcharge']),
                    row = v.text(s.row, 'row', 4).toUpperCase(),
                    number = v.positiveId(s.number, 'number');
                if (!/^[A-Z]{1,4}$/.test(row) || number > 1000)
                    return v.invalid('Seat row must be A-Z and seat number must be 1-1000.');
                const name = s.name === undefined ? `${row}${number}` : v.text(s.name, 'name', 20);
                if (positions.has(`${row}:${number}`) || names.has(name))
                    return v.invalid('Duplicate seat position or name.');
                positions.add(`${row}:${number}`);
                names.add(name);
                return {
                    row,
                    number,
                    name,
                    type:
                        s.type === undefined
                            ? 'THUONG'
                            : v.choice(s.type, ['THUONG', 'VIP'] as const, 'type'),
                    surcharge: s.surcharge === undefined ? 0 : v.money(s.surcharge, 'surcharge'),
                };
            });
            const room = await repo.createRoom(cinemaId, name, seats);
            return {
                id: room.id,
                cinemaId: room.id_cum_rap,
                name: room.ten_phong,
                seats,
            };
        },

        async createShowtime(body: CinemaInput): Promise<ShowtimeDto> {
            const d = v.object(body, ['movieId', 'roomId', 'startsAt', 'basePrice']);
            return showtimeDto(
                await repo.createShowtime(
                    v.positiveId(d.movieId, 'movieId'),
                    v.positiveId(d.roomId, 'roomId'),
                    v.utcDateTime(d.startsAt),
                    v.money(d.basePrice, 'basePrice'),
                ),
            );
        },
    };

    return service;
}

export const cinemaCatalogService = createCinemaCatalogService();
