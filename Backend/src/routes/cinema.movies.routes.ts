import type { CinemaHandlers } from '../types/cinema.http.types';
import type { CinemaPorts } from '../types/cinema.routes.types';
import { ok } from '../utils/cinema.response';
import { pageResponse } from '../utils/cinema.response';
import { id } from '../middleware/cinema.validate.middleware';
export function cinemaMoviesRoutes(ports: CinemaPorts): CinemaHandlers {
    const { catalog } = ports;
    return {
        movies: async (req, res) => pageResponse(res, await catalog.movies(req.query)),
        movie: async (req, res) => ok(res, await catalog.movie(id(req))),
        createMovie: async (req, res) => ok(res, await catalog.createMovie(req.body), 201),
        updateMovie: async (req, res) => ok(res, await catalog.updateMovie(id(req), req.body)),
    };
}
