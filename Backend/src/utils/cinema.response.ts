import type { CinemaHttpResponse, CinemaResponseData } from '../types/cinema.http.types';
import type { PaginationData } from '../types/cinema.request.types';
export function ok(
    res: CinemaHttpResponse,
    data: CinemaResponseData,
    status = 200,
): CinemaHttpResponse {
    return res.status(status).json({
        code: status,
        message: status === 201 ? 'Created.' : 'Success.',
        data,
    });
}
export function pageResponse(
    res: CinemaHttpResponse,
    result: {
        items: CinemaResponseData;
        pagination: PaginationData;
    },
) {
    return res.status(200).json({
        code: 200,
        message: 'Success.',
        data: result.items,
        pagination: result.pagination,
    });
}
