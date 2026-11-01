import type { CinemaHandlers } from '../types/cinema.http.types';
import type { CinemaPorts } from '../types/cinema.routes.types';
import { ok } from '../utils/cinema.response';
import { identity } from '../middleware/cinema.auth.middleware';
import { id } from '../middleware/cinema.validate.middleware';
export function cinemaPaymentsRoutes(ports: CinemaPorts): CinemaHandlers {
    const { payments } = ports;
    return {
        startPayment: async (req, res) =>
            ok(
                res,
                await payments.start(
                    id(req),
                    identity(req),
                    req.body,
                    req.header('Idempotency-Key'),
                ),
            ),
        paymentStatus: async (req, res) => ok(res, await payments.status(id(req), identity(req))),
        webhook: async (req, res) =>
            ok(
                res,
                await payments.webhook(
                    String(req.params.provider),
                    req.body,
                    req.header('X-Cinema-Signature'),
                ),
            ),
    };
}
