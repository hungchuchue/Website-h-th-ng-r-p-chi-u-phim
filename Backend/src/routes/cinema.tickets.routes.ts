import type { CinemaHandlers } from '../types/cinema.http.types';
import type { CinemaPorts } from '../types/cinema.routes.types';
import { ok } from '../utils/cinema.response';
import { identity } from '../middleware/cinema.auth.middleware';
import { id } from '../middleware/cinema.validate.middleware';
export function cinemaTicketsRoutes(ports: CinemaPorts): CinemaHandlers {
    const { bookings } = ports;
    return {
        bookingTickets: async (req, res) => ok(res, await bookings.tickets(id(req), identity(req))),
        ticket: async (req, res) => ok(res, await bookings.ticket(id(req), identity(req))),
    };
}
