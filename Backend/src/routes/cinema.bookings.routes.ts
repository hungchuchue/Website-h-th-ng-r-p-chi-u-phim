import type { CinemaHandlers } from '../types/cinema.http.types';
import type { CinemaPorts } from '../types/cinema.routes.types';
import { ok } from '../utils/cinema.response';
import { pageResponse } from '../utils/cinema.response';
import { identity } from '../middleware/cinema.auth.middleware';
import { id } from '../middleware/cinema.validate.middleware';
export function cinemaBookingsRoutes(ports: CinemaPorts): CinemaHandlers {
    const { bookings } = ports;
    return {
        hold: async (req, res) => {
            const result = await bookings.hold(
                req.body,
                req.header('Idempotency-Key'),
                identity(req),
            );
            return ok(res, result.data, result.replayed ? 200 : 201);
        },
        history: async (req, res) =>
            pageResponse(res, await bookings.history(identity(req), req.query)),
        booking: async (req, res) => ok(res, await bookings.get(id(req), identity(req))),
        cancel: async (req, res) => ok(res, await bookings.cancel(id(req), identity(req))),
    };
}
