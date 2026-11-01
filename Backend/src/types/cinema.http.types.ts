import type { Request, Response, RequestHandler } from 'express';
import type { BaseResponse } from './responses';
import type { CinemaParams } from './cinema.request.types';
import type { CinemaInput, CinemaQuery } from './cinema.input.types';
import type { CinemaEndpointDto } from './cinema.service.types';
export type CinemaResponseData = CinemaEndpointDto;
export type CinemaHttpRequest = Request<
    CinemaParams,
    BaseResponse<CinemaResponseData>,
    CinemaInput,
    CinemaQuery
>;
export type CinemaHttpResponse = Response<BaseResponse<CinemaResponseData>>;
export type CinemaMiddleware = RequestHandler<
    CinemaParams,
    BaseResponse<CinemaResponseData>,
    CinemaInput,
    CinemaQuery
>;
export type CinemaHandler = (
    req: CinemaHttpRequest,
    res: CinemaHttpResponse,
) => Promise<CinemaHttpResponse | void>;
export type CinemaHandlers = Partial<Record<string, CinemaHandler>>;
