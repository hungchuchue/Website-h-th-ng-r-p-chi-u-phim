import {
    cinemaStore,
    sql,
    requireSqlRow,
    type CinemaStore,
    type Bind,
} from './cinema.store.repository';
import type {
    CinemaRow,
    MovieRow,
    Page,
    RoomRow,
    SeatRow,
    ShowtimeRow,
    ShowtimeRecord,
} from '../types/cinema.types';
import type { MovieInput, PhysicalSeat } from '../types/cinema.catalog.types';
export type { MovieInput, PhysicalSeat } from '../types/cinema.catalog.types';
const movieKeys = [
    'title',
    'description',
    'genres',
    'director',
    'duration',
    'releaseDate',
    'posterUrl',
    'trailerUrl',
    'status',
] as const;
import type {
    CatalogRepository,
    RepositoryPage,
    PhysicalSeatRow,
} from '../types/cinema.repository.types';
export type { CatalogRepository } from '../types/cinema.repository.types';
import {
    decodeMovie,
    decodeTotal,
    decodeCinema,
    decodeRoom,
    decodePhysicalSeat,
    decodeShowtime,
    decodeSeat,
} from './cinema.sql.mapper';

export function createCinemaCatalogRepository(db: CinemaStore = cinemaStore): CatalogRepository {
    return {
        db,
        async movies(
            page: Page,
            status: string,
            search: string,
        ): Promise<RepositoryPage<MovieRow>> {
            const bind: Bind = (r) =>
                r
                    .input('status', sql.VarChar(20), status)
                    .input('search', sql.NVarChar(200), search)
                    .input('offset', sql.Int, page.offset)
                    .input('limit', sql.Int, page.limit);
            const where = "WHERE trang_thai=@status AND ten_phim LIKE N'%'+@search+N'%'";
            const [items, count] = await Promise.all([
                db.query<MovieRow>(
                    `SELECT * FROM dbo.PHIM ${where} ORDER BY ngay_khoi_chieu DESC,id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
                    decodeMovie,
                    bind,
                ),
                db.query<{
                    total: number;
                }>(`SELECT COUNT(*) total FROM dbo.PHIM ${where}`, decodeTotal, bind),
            ]);
            return { items, total: requireSqlRow(count).total };
        },
        async movie(id: number): Promise<MovieRow | undefined> {
            return (
                await db.query<MovieRow>('SELECT * FROM dbo.PHIM WHERE id=@id', decodeMovie, (r) =>
                    r.input('id', sql.Int, id),
                )
            )[0];
        },
        async createMovie(data: MovieInput): Promise<MovieRow> {
            return requireSqlRow(
                await db.query<MovieRow>(
                    'INSERT dbo.PHIM(ten_phim,mo_ta,the_loai,dao_dien,thoi_luong,ngay_khoi_chieu,poster_url,trailer_url,trang_thai) OUTPUT inserted.* VALUES(@title,@description,@genres,@director,@duration,@releaseDate,@posterUrl,@trailerUrl,@status)',
                    decodeMovie,
                    (r) =>
                        r
                            .input('title', sql.NVarChar(200), data.title)
                            .input('description', sql.NVarChar(sql.MAX), data.description)
                            .input('genres', sql.NVarChar(200), data.genres)
                            .input('director', sql.NVarChar(200), data.director)
                            .input('duration', sql.Int, data.duration)
                            .input('releaseDate', sql.Date, data.releaseDate)
                            .input('posterUrl', sql.NVarChar(2048), data.posterUrl)
                            .input('trailerUrl', sql.NVarChar(2048), data.trailerUrl)
                            .input('status', sql.VarChar(20), data.status),
                ),
            );
        },
        async updateMovie(id: number, data: Partial<MovieInput>): Promise<MovieRow | undefined> {
            // Duration is snapshotted in each existing showtime's end time; existing showtimes are never rewritten.
            const mapping = {
                title: ['ten_phim', sql.NVarChar(200)],
                description: ['mo_ta', sql.NVarChar(sql.MAX)],
                genres: ['the_loai', sql.NVarChar(200)],
                director: ['dao_dien', sql.NVarChar(200)],
                duration: ['thoi_luong', sql.Int],
                releaseDate: ['ngay_khoi_chieu', sql.Date],
                posterUrl: ['poster_url', sql.NVarChar(2048)],
                trailerUrl: ['trailer_url', sql.NVarChar(2048)],
                status: ['trang_thai', sql.VarChar(20)],
            } as const;
            const keys = Object.keys(data).filter((key): key is keyof MovieInput =>
                movieKeys.some((item) => item === key),
            );
            const bind: Bind = (r) => {
                r.input('id', sql.Int, id);
                for (const k of keys) r.input(k, mapping[k][1], data[k]);
                return r;
            };
            return (
                await db.query<MovieRow>(
                    `SET XACT_ABORT ON; BEGIN TRY BEGIN TRAN; DECLARE @locked_movie INT; SELECT @locked_movie=id FROM dbo.PHIM WITH(UPDLOCK,HOLDLOCK) WHERE id=@id; ${data.duration === undefined ? '' : "IF EXISTS(SELECT 1 FROM dbo.SUAT_CHIEU WHERE id_phim=@id AND ket_thuc_luc>SYSUTCDATETIME()) THROW 51002,N'Movie duration cannot change while future showtimes exist',1;"} UPDATE dbo.PHIM SET ${keys.map((k) => `${mapping[k][0]}=@${k}`).join(',')} OUTPUT inserted.* WHERE id=@id; COMMIT; END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH`,
                    decodeMovie,
                    bind,
                )
            )[0];
        },
        async cinemas(): Promise<CinemaRow[]> {
            return db.query<CinemaRow>(
                'SELECT * FROM dbo.CUM_RAP WHERE dang_hoat_dong=1 ORDER BY thanh_pho,ten_cum_rap,id',
                decodeCinema,
            );
        },
        async cinema(id: number): Promise<CinemaRow | undefined> {
            return (
                await db.query<CinemaRow>(
                    'SELECT * FROM dbo.CUM_RAP WHERE id=@id',
                    decodeCinema,
                    (r) => r.input('id', sql.Int, id),
                )
            )[0];
        },
        async createCinema(name: string, address: string, city: string): Promise<CinemaRow> {
            return requireSqlRow(
                await db.query<CinemaRow>(
                    'INSERT dbo.CUM_RAP(ten_cum_rap,dia_chi,thanh_pho) OUTPUT inserted.* VALUES(@name,@address,@city)',
                    decodeCinema,
                    (r) =>
                        r
                            .input('name', sql.NVarChar(200), name)
                            .input('address', sql.NVarChar(500), address)
                            .input('city', sql.NVarChar(120), city),
                ),
            );
        },
        async rooms(cinemaId: number): Promise<RoomRow[]> {
            return db.query<RoomRow>(
                'SELECT * FROM dbo.PHONG_CHIEU WHERE id_cum_rap=@cinemaId ORDER BY id',
                decodeRoom,
                (r) => r.input('cinemaId', sql.Int, cinemaId),
            );
        },
        async physicalSeats(cinemaId: number): Promise<PhysicalSeatRow[]> {
            return db.query<PhysicalSeatRow>(
                'SELECT g.* FROM dbo.GHE g JOIN dbo.PHONG_CHIEU p ON p.id=g.id_phong_chieu WHERE p.id_cum_rap=@cinemaId ORDER BY g.id_phong_chieu,g.hang_ghe,g.so_ghe',
                decodePhysicalSeat,
                (r) => r.input('cinemaId', sql.Int, cinemaId),
            );
        },
        async createRoom(cinemaId: number, name: string, seats: PhysicalSeat[]): Promise<RoomRow> {
            return requireSqlRow(
                await db.query<RoomRow>(
                    `SET XACT_ABORT ON; BEGIN TRY BEGIN TRAN;
   IF NOT EXISTS(SELECT 1 FROM dbo.CUM_RAP WHERE id=@cinemaId AND dang_hoat_dong=1) THROW 51001,N'Active cinema not found',1;
   INSERT dbo.PHONG_CHIEU(id_cum_rap,ten_phong) VALUES(@cinemaId,@name); DECLARE @id INT=CONVERT(INT,SCOPE_IDENTITY());
   INSERT dbo.GHE(id_phong_chieu,hang_ghe,so_ghe,ten_ghe,loai_ghe,phu_thu)
    SELECT @id,j.rowName,j.seatNumber,j.seatName,j.seatType,j.surcharge FROM OPENJSON(@seats) WITH(rowName VARCHAR(4) '$.row',seatNumber INT '$.number',seatName NVARCHAR(20) '$.name',seatType VARCHAR(10) '$.type',surcharge DECIMAL(18,2) '$.surcharge') j;
   COMMIT; SELECT * FROM dbo.PHONG_CHIEU WHERE id=@id;
   END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH`,
                    decodeRoom,
                    (r) =>
                        r
                            .input('cinemaId', sql.Int, cinemaId)
                            .input('name', sql.NVarChar(100), name)
                            .input('seats', sql.NVarChar(sql.MAX), JSON.stringify(seats)),
                ),
            );
        },
        async showtimes(
            filters: {
                movieId?: number;
                cinemaId?: number;
                date?: string;
            },
            page: Page,
        ): Promise<RepositoryPage<ShowtimeRow>> {
            const bind: Bind = (r) =>
                r
                    .input('movieId', sql.Int, filters.movieId ?? null)
                    .input('cinemaId', sql.Int, filters.cinemaId ?? null)
                    .input('date', sql.Date, filters.date ?? null)
                    .input('offset', sql.Int, page.offset)
                    .input('limit', sql.Int, page.limit);
            const from = `FROM dbo.SUAT_CHIEU sc JOIN dbo.PHIM m ON m.id=sc.id_phim JOIN dbo.PHONG_CHIEU p ON p.id=sc.id_phong_chieu JOIN dbo.CUM_RAP c ON c.id=p.id_cum_rap WHERE sc.trang_thai='MO_BAN' AND m.trang_thai='DANG_CHIEU' AND p.dang_hoat_dong=1 AND c.dang_hoat_dong=1 AND sc.bat_dau_luc>SYSUTCDATETIME() AND(@movieId IS NULL OR sc.id_phim=@movieId) AND(@cinemaId IS NULL OR c.id=@cinemaId) AND(@date IS NULL OR(sc.bat_dau_luc>=@date AND sc.bat_dau_luc<DATEADD(DAY,1,@date)))`;
            const [items, count] = await Promise.all([
                db.query<ShowtimeRow>(
                    `SELECT sc.*,m.ten_phim,p.ten_phong,c.ten_cum_rap,c.id id_cum_rap ${from} ORDER BY sc.bat_dau_luc,sc.id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
                    decodeShowtime,
                    bind,
                ),
                db.query<{
                    total: number;
                }>(`SELECT COUNT(*) total ${from}`, decodeTotal, bind),
            ]);
            return { items, total: requireSqlRow(count).total };
        },
        async showtime(id: number): Promise<ShowtimeRow | undefined> {
            return (
                await db.query<ShowtimeRow>(
                    'SELECT sc.*,m.ten_phim,p.ten_phong,c.ten_cum_rap,c.id id_cum_rap FROM dbo.SUAT_CHIEU sc JOIN dbo.PHIM m ON m.id=sc.id_phim JOIN dbo.PHONG_CHIEU p ON p.id=sc.id_phong_chieu JOIN dbo.CUM_RAP c ON c.id=p.id_cum_rap WHERE sc.id=@id',
                    decodeShowtime,
                    (r) => r.input('id', sql.Int, id),
                )
            )[0];
        },
        async createShowtime(
            movieId: number,
            roomId: number,
            startsAt: Date,
            price: number,
        ): Promise<ShowtimeRecord> {
            return requireSqlRow(
                await db.execute<ShowtimeRecord>('dbo.sp_tao_suat_chieu', decodeShowtime, (r) =>
                    r
                        .input('id_phim', sql.Int, movieId)
                        .input('id_phong_chieu', sql.Int, roomId)
                        .input('bat_dau_luc', sql.DateTime2(3), startsAt)
                        .input('gia_co_ban', sql.Decimal(18, 2), price),
                ),
            );
        },
        async seats(showtimeId: number): Promise<SeatRow[]> {
            return db.query<SeatRow>(
                `SELECT gs.id_ghe,g.ten_ghe,g.hang_ghe,g.so_ghe,g.loai_ghe,sc.gia_co_ban+g.phu_thu gia_ve,
  CASE WHEN gs.trang_thai='DANG_GIU' AND gs.het_han_luc<=SYSUTCDATETIME() THEN 'TRONG' ELSE gs.trang_thai END trang_thai,
  CASE WHEN gs.het_han_luc>SYSUTCDATETIME() THEN gs.het_han_luc ELSE NULL END het_han_luc
  FROM dbo.GHE_SUAT_CHIEU gs JOIN dbo.GHE g ON g.id=gs.id_ghe JOIN dbo.SUAT_CHIEU sc ON sc.id=gs.id_suat_chieu WHERE gs.id_suat_chieu=@showtimeId ORDER BY g.hang_ghe,g.so_ghe`,
                decodeSeat,
                (r) => r.input('showtimeId', sql.Int, showtimeId),
            );
        },
    };
}

export const cinemaCatalogRepository: CatalogRepository = createCinemaCatalogRepository();
