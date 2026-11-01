import type { CinemaHandlers } from '../types/cinema.http.types';
import type { CinemaPorts } from '../types/cinema.routes.types';
import { ok } from '../utils/cinema.response';
import { identity } from '../middleware/cinema.auth.middleware';
export function cinemaAuthRoutes(ports: CinemaPorts): CinemaHandlers {
    const { auth } = ports;
    return {
        register: async (req, res) => ok(res, await auth.register(req.body), 201),
        login: async (req, res) => ok(res, await auth.login(req.body)),
        me: async (req, res) => ok(res, await auth.me(identity(req))),
    };
}
