import type { CinemaHandlers } from '../types/cinema.http.types';
import type { CinemaPorts } from '../types/cinema.routes.types';
import { ok } from '../utils/cinema.response';
import { pageResponse } from '../utils/cinema.response';
import { id } from '../middleware/cinema.validate.middleware';
export function cinemaShowtimesRoutes(ports: CinemaPorts): CinemaHandlers {
    const { catalog } = ports;
    return {
        showtimes: async (req, res) => pageResponse(res, await catalog.showtimes(req.query)),
        showtime: async (req, res) => ok(res, await catalog.showtime(id(req))),
        createShowtime: async (req, res) => ok(res, await catalog.createShowtime(req.body), 201),
        seats: async (req, res) => ok(res, await catalog.seats(id(req))),
    };
}
