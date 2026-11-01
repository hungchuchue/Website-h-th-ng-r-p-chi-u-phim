import { createCinemaOutboxRepository } from '../repositories/cinema.outbox.repository';
import { createCinemaAuthService } from '../services/cinema.auth.service';
import { createCinemaCatalogService } from '../services/cinema.catalog.service';
import { createCinemaBookingService } from '../services/cinema.booking.service';
import { createCinemaPaymentService } from '../services/cinema.payment.service';
import { createCinemaAdminService } from '../services/cinema.admin.service';
import { Router, type RequestHandler } from 'express';
import { cinemaEnabled, cinemaSettings } from '../config/cinema';
import { cinemaContracts } from '../config/cinema.contracts';
import { cinemaErrorHandler } from '../middleware/cinema.errors.middleware';
import { cinemaCorrelation } from '../middleware/cinema.context.middleware';
import { cinemaProtectedRoute } from '../middleware/cinema.auth.middleware';
import { cinemaAuthLimit } from '../middleware/cinema.rate-limit.middleware';

import { cinemaOutboxProcessor } from '../jobs/cinema.outbox.worker';
import { registerCinemaDocs } from './cinema.docs.routes';
import type { CinemaRouterOptions, CinemaPorts } from '../types/cinema.routes.types';
import type { CinemaHandlers, CinemaMiddleware } from '../types/cinema.http.types';
import { cinemaAuthRoutes } from './cinema.auth.routes';
import { cinemaMoviesRoutes } from './cinema.movies.routes';
import { cinemaCinemasRoutes } from './cinema.cinemas.routes';
import { cinemaShowtimesRoutes } from './cinema.showtimes.routes';
import { cinemaBookingsRoutes } from './cinema.bookings.routes';
import { cinemaPaymentsRoutes } from './cinema.payments.routes';
import { cinemaTicketsRoutes } from './cinema.tickets.routes';
import { cinemaAdminRoutes } from './cinema.admin.routes';
export function createCinemaRouter(options: CinemaRouterOptions = {}): Router {
    const router = Router();
    const auth = options.ports?.auth ?? createCinemaAuthService(),
        catalog = options.ports?.catalog ?? createCinemaCatalogService(),
        bookings = options.ports?.bookings ?? createCinemaBookingService(),
        outbox = options.ports?.outbox ?? createCinemaOutboxRepository();
    const payments =
        options.ports?.payments ??
        createCinemaPaymentService(undefined, undefined, undefined, async (key) => {
            await cinemaOutboxProcessor.processOne(key);
        });
    const dashboard =
        options.ports?.dashboard ?? (() => createCinemaBookingService().repo.dashboard());
    const admin = options.ports?.admin ?? createCinemaAdminService(outbox, dashboard);
    const ports: CinemaPorts = { auth, catalog, bookings, outbox, payments, dashboard, admin };
    const enabled = options.enabled ?? cinemaEnabled,
        environment = options.environment ?? cinemaSettings().environment;
    router.use(cinemaCorrelation);
    registerCinemaDocs(router, environment);
    router.use((_req, _res, next) => (enabled() ? next() : next('router')));
    const authLimit = cinemaAuthLimit();
    const protectedRoute = cinemaProtectedRoute(auth);
    const handlers: CinemaHandlers = {};
    for (const [key, handler] of Object.entries(cinemaAuthRoutes(ports))) {
        if (handlers[key]) throw new Error(`Duplicate Cinema handler: ${key}`);
        handlers[key] = handler;
    }
    for (const [key, handler] of Object.entries(cinemaMoviesRoutes(ports))) {
        if (handlers[key]) throw new Error(`Duplicate Cinema handler: ${key}`);
        handlers[key] = handler;
    }
    for (const [key, handler] of Object.entries(cinemaCinemasRoutes(ports))) {
        if (handlers[key]) throw new Error(`Duplicate Cinema handler: ${key}`);
        handlers[key] = handler;
    }
    for (const [key, handler] of Object.entries(cinemaShowtimesRoutes(ports))) {
        if (handlers[key]) throw new Error(`Duplicate Cinema handler: ${key}`);
        handlers[key] = handler;
    }
    for (const [key, handler] of Object.entries(cinemaBookingsRoutes(ports))) {
        if (handlers[key]) throw new Error(`Duplicate Cinema handler: ${key}`);
        handlers[key] = handler;
    }
    for (const [key, handler] of Object.entries(cinemaPaymentsRoutes(ports))) {
        if (handlers[key]) throw new Error(`Duplicate Cinema handler: ${key}`);
        handlers[key] = handler;
    }
    for (const [key, handler] of Object.entries(cinemaTicketsRoutes(ports))) {
        if (handlers[key]) throw new Error(`Duplicate Cinema handler: ${key}`);
        handlers[key] = handler;
    }
    for (const [key, handler] of Object.entries(cinemaAdminRoutes(ports))) {
        if (handlers[key]) throw new Error(`Duplicate Cinema handler: ${key}`);
        handlers[key] = handler;
    }
    for (const contract of cinemaContracts) {
        if (contract.access === 'WEBHOOK' && !['development', 'test'].includes(environment))
            continue;
        const handler = handlers[contract.id];
        if (!handler) throw new Error(`Missing Cinema handler: ${contract.id}`);
        const middleware: CinemaMiddleware[] = [];
        if (['register', 'login'].includes(contract.id)) middleware.push(authLimit);
        if (
            contract.access === 'AUTHENTICATED' ||
            contract.access === 'CUSTOMER' ||
            contract.access === 'ADMIN'
        )
            middleware.push(protectedRoute(contract.access));
        router[contract.method](contract.path, ...middleware, (req, res, next) => {
            Promise.resolve(handler(req, res)).catch(next);
        });
    }
    router.use(cinemaErrorHandler);
    return router;
}
let activeRouter: Router | undefined;
export const cinemaRouter: RequestHandler = (req, res, next) => {
    activeRouter ??= createCinemaRouter();
    activeRouter(req, res, next);
};
