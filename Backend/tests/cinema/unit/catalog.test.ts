import { createCinemaCatalogService } from '../../../src/services/cinema.catalog.service';
import { createCinemaCatalogRepository } from '../../../src/repositories/cinema.catalog.repository';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    CatalogRepository,
    type MovieInput,
    type PhysicalSeat,
} from '../../../src/repositories/cinema.catalog.repository';
import type { MovieRow } from '../../../src/types/cinema.types';
const row: MovieRow = {
    id: 1,
    ten_phim: 'Example',
    mo_ta: 'Description',
    the_loai: 'Drama',
    dao_dien: 'Director',
    thoi_luong: 120,
    ngay_khoi_chieu: new Date('2026-11-01'),
    poster_url: 'https://example.test/poster.png',
    trailer_url: null,
    trang_thai: 'DANG_CHIEU',
};
function createCatalogFixture(): CatalogRepository & {
    movieWrites: number;
    roomWrites: number;
    showtimeWrites: number;
    lastSeats: PhysicalSeat[];
    lastStart: Date | undefined;
} {
    return {
        ...createCinemaCatalogRepository(),
        movieWrites: 0,
        roomWrites: 0,
        showtimeWrites: 0,
        lastSeats: [],
        lastStart: undefined,
        async createMovie(_data: MovieInput) {
            this.movieWrites++;
            return row;
        },
        async createRoom(cinemaId: number, name: string, seats: PhysicalSeat[]) {
            this.roomWrites++;
            this.lastSeats = seats;
            return {
                id: 1,
                id_cum_rap: cinemaId,
                ten_phong: name,
                dang_hoat_dong: true,
            };
        },
        async createShowtime(movieId: number, roomId: number, start: Date, price: number) {
            this.showtimeWrites++;
            this.lastStart = start;
            return {
                id: 1,
                id_phim: movieId,
                id_phong_chieu: roomId,
                bat_dau_luc: start,
                ket_thuc_luc: new Date(start.getTime() + 7200000),
                gia_co_ban: price,
                trang_thai: 'MO_BAN',
            };
        },
    };
}
test('movie DTO validation rejects unsafe fields and invalid catalog values before SQL access', async () => {
    const repo = createCatalogFixture(),
        service = createCinemaCatalogService(repo);
    const valid = {
        title: 'Example',
        description: 'Description',
        genres: 'Drama',
        director: 'Director',
        duration: 120,
        releaseDate: '2026-11-01',
        posterUrl: 'https://example.test/poster.png',
    };
    for (const invalid of [
        { ...valid, duration: 601 },
        { ...valid, releaseDate: '2026-02-30' },
        { ...valid, posterUrl: 'javascript:alert(1)' },
        { ...valid, role: 'ADMIN' },
    ])
        await assert.rejects(service.createMovie(invalid));
    assert.equal(repo.movieWrites, 0);
    const dto = await service.createMovie(valid);
    assert.equal(dto.title, 'Example');
    assert.equal(dto.duration, 120);
    assert.equal(repo.movieWrites, 1);
});
test('physical layouts are validated as a whole before any room is created', async () => {
    const repo = createCatalogFixture(),
        service = createCinemaCatalogService(repo);
    await assert.rejects(
        service.createRoom({
            cinemaId: 1,
            name: 'Room',
            seats: [
                { row: 'A', number: 1 },
                { row: 'a', number: 1 },
            ],
        }),
    );
    assert.equal(repo.roomWrites, 0);
    const result = await service.createRoom({
        cinemaId: 1,
        name: 'Room',
        seats: [
            { row: 'a', number: 1 },
            { row: 'A', number: 2, type: 'VIP', surcharge: 10000 },
        ],
    });
    assert.equal(result.seats[0]!.name, 'A1');
    assert.equal(result.seats[0]!.type, 'THUONG');
    assert.equal(repo.lastSeats[1]!.surcharge, 10000);
});
test('showtime requests carry timezone-aware dates and reject client supplied end times', async () => {
    const repo = createCatalogFixture(),
        service = createCinemaCatalogService(repo);
    await assert.rejects(
        service.createShowtime({
            movieId: 1,
            roomId: 1,
            startsAt: '2026-11-01T12:00:00',
            basePrice: 75000,
        }),
    );
    await assert.rejects(
        service.createShowtime({
            movieId: 1,
            roomId: 1,
            startsAt: '2026-11-01T12:00:00Z',
            basePrice: 75000,
            endsAt: '2026-11-01T12:01:00Z',
        }),
    );
    assert.equal(repo.showtimeWrites, 0);
    await service.createShowtime({
        movieId: 1,
        roomId: 1,
        startsAt: '2026-11-01T12:00:00+07:00',
        basePrice: 75000,
    });
    assert.equal(repo.lastStart!.toISOString(), '2026-11-01T05:00:00.000Z');
});
