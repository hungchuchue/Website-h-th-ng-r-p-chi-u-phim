import type { CinemaHandlers } from '../types/cinema.http.types';
import type { CinemaPorts } from '../types/cinema.routes.types';
import { ok } from '../utils/cinema.response';
import { pageResponse } from '../utils/cinema.response';
import { identity } from '../middleware/cinema.auth.middleware';
import { id } from '../middleware/cinema.validate.middleware';
export function cinemaAdminRoutes(ports: CinemaPorts): CinemaHandlers {
    const { catalog, bookings, admin } = ports;
    return {
        dashboard: async (req, res) => ok(res, await admin.dashboard()),
        adminBookings: async (req, res) =>
            pageResponse(res, await bookings.history(identity(req), req.query, true)),
        adminBooking: async (req, res) => ok(res, await bookings.get(id(req), identity(req))),
        steps: async (req, res) => ok(res, await bookings.steps(id(req), identity(req))),
        outbox: async (req, res) => pageResponse(res, await admin.outbox(req.query)),
        seatStatus: async (req, res) => ok(res, await catalog.seats(id(req))),
    };
}
