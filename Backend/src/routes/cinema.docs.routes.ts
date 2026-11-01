import type { Router, Request, Response } from 'express';
import type { CinemaParams } from '../types/cinema.request.types';
import type { CinemaInput, CinemaQuery } from '../types/cinema.input.types';

import type { NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { cinemaOpenApi } from '../config/cinema.openapi';
import { cinemaDocsHtml } from './cinema.docs.html';
export function registerCinemaDocs(router: Router, environment: string): void {
    // Documentation is reviewable without enabling database-backed business routes.
    router.get('/cinema/openapi.json', (_req, res) => res.json(cinemaOpenApi(environment)));
    const document = cinemaOpenApi(environment);
    router.get('/cinema/docs', (req, res, next) => {
        if (!req.path.endsWith('/')) {
            res.redirect(302, req.baseUrl + '/cinema/docs/');
            return;
        }
        next();
    });
    router.use(
        '/cinema/docs',
        swaggerUi.serveFiles(document),
        (
            req: Request<CinemaParams, string, CinemaInput, CinemaQuery>,
            res: Response<string>,
            next: NextFunction,
        ) => {
            if (req.method === 'GET' && req.path === '/') {
                res.type('html').send(cinemaDocsHtml);
                return;
            }
            next();
        },
    );
}
