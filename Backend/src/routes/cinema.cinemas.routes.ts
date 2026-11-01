import type { CinemaHandlers } from '../types/cinema.http.types';
import type { CinemaPorts } from '../types/cinema.routes.types';
import { ok } from '../utils/cinema.response';
import { id } from '../middleware/cinema.validate.middleware';
export function cinemaCinemasRoutes(ports: CinemaPorts): CinemaHandlers {
    const { catalog } = ports;
    return {
        cinemas: async (_req, res) => ok(res, await catalog.cinemas()),
        rooms: async (req, res) => ok(res, await catalog.rooms(id(req))),
        createCinema: async (req, res) => ok(res, await catalog.createCinema(req.body), 201),
        createRoom: async (req, res) => ok(res, await catalog.createRoom(req.body), 201),
    };
}
