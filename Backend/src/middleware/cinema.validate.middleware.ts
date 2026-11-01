import type { CinemaHttpRequest } from '../types/cinema.http.types';
import { positiveId } from '../utils/cinema.validation';
export function id(req: CinemaHttpRequest): number {
    return positiveId(req.params.id);
}
