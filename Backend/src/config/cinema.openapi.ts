import { cinemaSettings } from './cinema';
import { cinemaContracts, type EndpointContract } from './cinema.contracts';
import type {
    OpenApiSchema as Schema,
    OpenApiParameter,
    OpenApiResponse,
    OpenApiPaths,
    CinemaOpenApiDocument,
} from '../types/cinema.openapi.types';
import type { JsonValue, JsonObject } from '../types/cinema.input.types';
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const str = (example: string, maxLength?: number): Schema => ({
    type: 'string',
    example,
    ...(maxLength ? { maxLength } : {}),
});
const id: Schema = {
    type: 'integer',
    minimum: 1,
    maximum: 2147483647,
    example: 15,
};
const amount: Schema = {
    type: 'number',
    minimum: 0,
    maximum: 2000000000000,
    multipleOf: 0.01,
    example: 75000,
};
const time: Schema = {
    type: 'string',
    format: 'date-time',
    example: '2026-11-01T12:07:00.000Z',
};
const obj = (
    properties: Record<string, Schema>,
    required: string[] = Object.keys(properties),
    strict = false,
): Schema => ({
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
    ...(strict ? { additionalProperties: false } : {}),
});
const arr = (name: string): Schema => ({ type: 'array', items: ref(name) });
const states = [
    'CHO_THANH_TOAN',
    'DA_THANH_TOAN',
    'HOAN_TAT',
    'THAT_BAI',
    'HET_HAN',
    'DA_HUY',
    'CHO_HOAN_TIEN',
    'DA_HOAN_TIEN',
];
const movieProperties = {
    title: str('Example Movie', 200),
    description: str('A cinema story.', 20000),
    genres: str('Drama', 200),
    director: str('Example Director', 200),
    duration: { type: 'integer', minimum: 1, maximum: 600, example: 120 },
    releaseDate: { type: 'string', format: 'date', example: '2026-11-01' },
    posterUrl: {
        type: 'string',
        format: 'uri',
        example: 'https://example.com/poster.jpg',
    },
    trailerUrl: {
        type: 'string',
        format: 'uri',
        nullable: true,
        example: 'https://example.com/trailer',
    },
    status: {
        type: 'string',
        enum: ['DANG_CHIEU', 'NGUNG_CHIEU'],
        default: 'DANG_CHIEU',
    },
};
export const cinemaSchemas: Record<string, Schema> = {
    RegisterRequest: obj(
        {
            email: {
                type: 'string',
                format: 'email',
                maxLength: 254,
                example: 'customer@example.com',
            },
            password: {
                type: 'string',
                format: 'password',
                minLength: 12,
                maxLength: 128,
                writeOnly: true,
                example: 'ExamplePassword123!',
            },
            displayName: str('Example Customer', 120),
        },
        ['email', 'password'],
        true,
    ),
    LoginRequest: obj(
        {
            email: {
                type: 'string',
                format: 'email',
                example: 'customer@example.com',
            },
            password: {
                type: 'string',
                format: 'password',
                minLength: 1,
                maxLength: 128,
                writeOnly: true,
                example: 'ExamplePassword123!',
            },
            accountType: {
                type: 'string',
                enum: ['CUSTOMER', 'ADMIN'],
                default: 'CUSTOMER',
            },
        },
        ['email', 'password'],
        true,
    ),
    Account: obj({
        id,
        email: { type: 'string', format: 'email', example: 'customer@example.com' },
        displayName: str('Example Customer'),
        role: { type: 'string', enum: ['CUSTOMER', 'ADMIN'], example: 'CUSTOMER' },
    }),
    Auth: obj({
        accessToken: str('<Cinema JWT>'),
        tokenType: { type: 'string', enum: ['Bearer'] },
        expiresIn: { type: 'integer', example: 900 },
        user: ref('Account'),
    }),
    MovieRequest: obj(
        movieProperties,
        ['title', 'description', 'genres', 'director', 'duration', 'releaseDate', 'posterUrl'],
        true,
    ),
    MoviePatch: { ...obj(movieProperties, [], true), minProperties: 1 },
    Movie: obj({ id, ...movieProperties }),
    CinemaRequest: obj(
        {
            name: str('Example Cinema', 200),
            address: str('Example Address', 500),
            city: str('Ho Chi Minh City', 120),
        },
        undefined,
        true,
    ),
    Cinema: obj(
        {
            id,
            name: str('Example Cinema'),
            address: str('Example Address'),
            city: str('Ho Chi Minh City'),
            active: { type: 'boolean', example: true },
        },
        ['id', 'name', 'address', 'city'],
    ),
    CinemaList: arr('Cinema'),
    PhysicalSeat: obj(
        {
            id,
            row: str('A', 4),
            number: { type: 'integer', minimum: 1, maximum: 1000, example: 1 },
            name: str('A1', 20),
            type: { type: 'string', enum: ['THUONG', 'VIP'] },
            surcharge: amount,
        },
        ['row', 'number'],
    ),
    PhysicalSeatRequest: obj(
        {
            row: { ...str('A', 4), pattern: '^[A-Za-z]{1,4}$' },
            number: { type: 'integer', minimum: 1, maximum: 1000, example: 1 },
            name: str('A1', 20),
            type: { type: 'string', enum: ['THUONG', 'VIP'], default: 'THUONG' },
            surcharge: { ...amount, maximum: 1000000000, default: 0, example: 0 },
        },
        ['row', 'number'],
        true,
    ),
    RoomRequest: obj(
        {
            cinemaId: id,
            name: str('Room 1', 100),
            seats: {
                type: 'array',
                minItems: 1,
                maxItems: 1000,
                items: { ...ref('PhysicalSeatRequest') },
            },
        },
        ['cinemaId', 'name', 'seats'],
        true,
    ),
    Room: obj(
        {
            id,
            cinemaId: id,
            name: str('Room 1'),
            active: { type: 'boolean' },
            seats: arr('PhysicalSeat'),
        },
        ['id', 'cinemaId', 'name', 'seats'],
    ),
    RoomList: arr('Room'),
    ShowtimeRequest: obj(
        {
            movieId: id,
            roomId: id,
            startsAt: time,
            basePrice: { ...amount, maximum: 1000000000 },
        },
        undefined,
        true,
    ),
    Showtime: obj(
        {
            id,
            movieId: id,
            roomId: id,
            cinemaId: id,
            startsAt: time,
            endsAt: time,
            basePrice: amount,
            currency: { type: 'string', enum: ['VND'] },
            status: { type: 'string', enum: ['MO_BAN', 'DONG'] },
            movieTitle: str('Example Movie'),
            roomName: str('Room 1'),
            cinemaName: str('Example Cinema'),
        },
        ['id', 'movieId', 'roomId', 'startsAt', 'endsAt', 'basePrice', 'currency', 'status'],
    ),
    Seat: obj({
        seatId: id,
        seatName: str('A1'),
        row: str('A'),
        number: { type: 'integer', example: 1 },
        type: { type: 'string', enum: ['THUONG', 'VIP'] },
        price: amount,
        status: {
            type: 'string',
            enum: ['TRONG', 'DANG_GIU', 'DA_BAN'],
            description: 'TRONG=FREE; DANG_GIU=HELD; DA_BAN=SOLD',
        },
        expiresAt: { ...time, nullable: true },
    }),
    SeatMap: obj({
        showtime: ref('Showtime'),
        serverTime: time,
        seats: arr('Seat'),
    }),
    HoldRequest: obj(
        {
            showtimeId: id,
            seatIds: {
                type: 'array',
                minItems: 1,
                maxItems: 1000,
                uniqueItems: true,
                items: id,
                example: [1, 2],
            },
        },
        undefined,
        true,
    ),
    BookingSeat: obj({ seatId: id, seatName: str('A1'), price: amount }),
    Booking: obj(
        {
            bookingId: id,
            bookingCode: str('DH-EXAMPLE-001'),
            showtimeId: id,
            selectedSeats: arr('BookingSeat'),
            totalAmount: amount,
            currency: { type: 'string', enum: ['VND'] },
            status: { type: 'string', enum: states },
            expiresAt: time,
            remainingSeconds: { type: 'integer', minimum: 0, example: 420 },
            paymentStatus: {
                type: 'string',
                nullable: true,
                enum: ['CHO', 'THANH_CONG', 'THAT_BAI', 'CHO_HOAN_TIEN', 'DA_HOAN_TIEN', null],
            },
            issuedTicketCount: { type: 'integer', minimum: 0 },
            createdAt: time,
            failureReason: { type: 'string', nullable: true },
            movieTitle: str('Example Movie'),
            startsAt: time,
            roomName: str('Room 1'),
            cinemaName: str('Example Cinema'),
            payments: arr('Payment'),
        },
        [
            'bookingId',
            'bookingCode',
            'showtimeId',
            'selectedSeats',
            'totalAmount',
            'currency',
            'status',
            'expiresAt',
            'remainingSeconds',
        ],
    ),
    PaymentRequest: obj(
        { provider: { type: 'string', enum: ['simulator'], default: 'simulator' } },
        [],
        true,
    ),
    Payment: obj(
        {
            id,
            bookingId: id,
            paymentReference: str('00000000-0000-4000-8000-000000000001'),
            provider: { type: 'string', enum: ['simulator'] },
            amount,
            receivedAmount: { ...amount, nullable: true },
            currency: { type: 'string', enum: ['VND'] },
            status: {
                type: 'string',
                enum: ['CHO', 'THANH_CONG', 'THAT_BAI', 'CHO_HOAN_TIEN', 'DA_HOAN_TIEN'],
            },
            transactionId: { type: 'string', nullable: true },
            refundReference: { type: 'string', nullable: true },
            createdAt: time,
            updatedAt: time,
            paymentUrl: { type: 'string', nullable: true, example: null },
            simulationRequired: { type: 'boolean', example: true },
            expiresAt: time,
        },
        ['id', 'bookingId', 'paymentReference', 'provider', 'amount', 'currency', 'status'],
    ),
    PaymentList: arr('Payment'),
    CallbackRequest: obj(
        {
            bookingId: id,
            paymentReference: str('00000000-0000-4000-8000-000000000001'),
            transactionId: str('SIM-EXAMPLE', 128),
            amount,
            currency: { type: 'string', enum: ['VND'] },
            status: { type: 'string', enum: ['SUCCESS', 'FAILED', 'UNKNOWN'] },
            timestamp: {
                type: 'integer',
                description:
                    'Current Unix seconds; sign the canonical payload, do not reuse this illustrative timestamp.',
                example: 1793448000,
            },
        },
        undefined,
        true,
    ),
    CallbackResult: obj(
        {
            paymentReference: str('00000000-0000-4000-8000-000000000001'),
            status: {
                type: 'string',
                enum: ['CHO', 'THANH_CONG', 'THAT_BAI', 'CHO_HOAN_TIEN', 'DA_HOAN_TIEN'],
            },
            reconciliationRequired: { type: 'boolean' },
        },
        ['paymentReference', 'status'],
    ),
    Ticket: obj({
        id,
        bookingId: id,
        showtimeId: id,
        seatId: id,
        ticketCode: str('VE-EXAMPLE'),
        qrToken: {
            type: 'string',
            pattern: '^[A-Fa-f0-9]{64}$',
            example: '0'.repeat(64),
        },
        price: amount,
        currency: { type: 'string', enum: ['VND'] },
        status: { type: 'string', enum: ['HOP_LE'] },
        movieTitle: str('Example Movie'),
        startsAt: time,
        roomName: str('Room 1'),
        cinemaName: str('Example Cinema'),
        seatName: str('A1'),
    }),
    TicketList: arr('Ticket'),
    TransactionStep: obj({
        id: { type: 'string', example: '1' },
        step: str('GIU_GHE'),
        action: { type: 'string', enum: ['THUC_HIEN', 'BU_TRU'] },
        status: { type: 'string', enum: ['CHO', 'THANH_CONG', 'THAT_BAI'] },
        message: { type: 'string', nullable: true },
        createdAt: time,
    }),
    TransactionStepList: arr('TransactionStep'),
    OutboxEvent: obj({
        id: { type: 'string', example: '1' },
        eventKey: str('ISSUE:101'),
        bookingId: id,
        paymentId: { ...id, nullable: true },
        type: { type: 'string', enum: ['PHAT_HANH_VE', 'HOAN_TIEN'] },
        status: { type: 'string', enum: ['CHO', 'THAT_BAI', 'HOAN_TAT'] },
        attempts: { type: 'integer', minimum: 0, maximum: 5 },
        procedureFailures: { type: 'integer', minimum: 0 },
        retryAt: time,
        lockedUntil: { ...time, nullable: true },
        requiresReview: { type: 'boolean' },
        lastError: { type: 'string', nullable: true },
    }),
    Dashboard: obj({
        bookingsByStatus: {
            type: 'array',
            items: obj({
                status: { type: 'string', enum: states },
                count: { type: 'integer' },
            }),
        },
        revenue: amount,
        currency: { type: 'string', enum: ['VND'] },
        issuedTickets: { type: 'integer' },
        failedOutboxEvents: { type: 'integer' },
    }),
    Error: obj({
        code: { type: 'integer', example: 409 },
        message: str('One or more seats are unavailable.'),
        data: { type: 'object', nullable: true, example: null },
    }),
    Pagination: obj({
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 50 },
    }),
};
export function responseSchema(c: EndpointContract): Schema {
    return obj({
        code: { type: 'integer', example: c.created ? 201 : 200 },
        message: str('Success'),
        data: c.paginated ? { type: 'array', items: ref(c.response) } : ref(c.response),
        ...(c.paginated ? { pagination: ref('Pagination') } : {}),
    });
}
const successExamples: JsonObject = {
    Auth: {
        accessToken: '<Cinema JWT>',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
            id: 1,
            email: 'customer@example.com',
            displayName: 'Example Customer',
            role: 'CUSTOMER',
        },
    },
    Account: {
        id: 1,
        email: 'customer@example.com',
        displayName: 'Example Customer',
        role: 'CUSTOMER',
    },
    Movie: {
        id: 1,
        title: 'Example Movie',
        description: 'A cinema story.',
        genres: 'Drama',
        director: 'Example Director',
        duration: 120,
        releaseDate: '2026-11-01',
        posterUrl: 'https://example.com/poster.jpg',
        trailerUrl: null,
        status: 'DANG_CHIEU',
    },
    Booking: {
        bookingId: 101,
        bookingCode: 'DH-EXAMPLE-001',
        showtimeId: 15,
        selectedSeats: [{ seatId: 1, seatName: 'A1', price: 75000 }],
        totalAmount: 75000,
        currency: 'VND',
        status: 'CHO_THANH_TOAN',
        expiresAt: '2026-11-01T12:07:00Z',
        remainingSeconds: 420,
    },
    CallbackResult: {
        paymentReference: '00000000-0000-4000-8000-000000000001',
        status: 'THANH_CONG',
    },
};
function exampleForSchema(name: string, depth = 0): JsonValue {
    if (successExamples[name]) return successExamples[name];
    if (depth > 4) return null;
    const schema = cinemaSchemas[name];
    if (!schema) throw new Error(`Missing Cinema OpenAPI schema: ${name}`);
    if (schema.type === 'array') {
        const item = schema.items;
        return [exampleForSchema(item?.$ref?.split('/').pop() || '', depth + 1)];
    }
    const result: JsonObject = {};
    for (const [key, raw] of Object.entries(schema.properties || {})) {
        if (raw.example !== undefined) result[key] = raw.example;
        else if (raw.$ref)
            result[key] = exampleForSchema(String(raw.$ref).split('/').pop() ?? '', depth + 1);
        else if (raw.enum) result[key] = raw.enum[0];
        else if (raw.type === 'array') {
            const item = raw.items;
            result[key] =
                Number(raw.minItems || 0) > 0
                    ? [
                          item?.$ref
                              ? exampleForSchema(
                                    String(item.$ref).split('/').pop() ?? '',
                                    depth + 1,
                                )
                              : (item?.example ?? 1),
                      ]
                    : [];
        } else if (raw.type === 'integer' || raw.type === 'number') result[key] = 0;
        else if (raw.type === 'boolean') result[key] = false;
        else result[key] = raw.nullable ? null : 'example';
    }
    return result;
}
export function cinemaOpenApi(
    environment = process.env.NODE_ENV || 'development',
): CinemaOpenApiDocument {
    const c = cinemaSettings(),
        base = c.baseUrl.replace(/\/+$/, '');
    const paths: OpenApiPaths = {};
    for (const endpoint of cinemaContracts) {
        if (endpoint.access === 'WEBHOOK' && !['development', 'test'].includes(environment))
            continue;
        const parameters: OpenApiParameter[] = [];
        for (const parameter of endpoint.path.matchAll(/:([A-Za-z]+)/g))
            parameters.push({
                in: 'path',
                name: parameter[1] ?? '',
                required: true,
                schema: parameter[1] === 'provider' ? { type: 'string', enum: ['simulator'] } : id,
                description:
                    parameter[1] === 'provider'
                        ? 'Development/test simulator only.'
                        : 'Resource identifier.',
            });
        for (const query of endpoint.queries || [])
            parameters.push({
                in: 'query',
                name: query,
                required: false,
                description:
                    query === 'date'
                        ? 'UTC calendar date YYYY-MM-DD'
                        : query === 'status'
                          ? 'Allowed values depend on resource; see response status enum.'
                          : `Filter or pagination field: ${query}`,
                schema: ['page', 'limit', 'movieId', 'cinemaId'].includes(query)
                    ? {
                          type: 'integer',
                          minimum: 1,
                          ...(query === 'limit' ? { maximum: 100 } : {}),
                          default: query === 'page' ? 1 : query === 'limit' ? 20 : undefined,
                      }
                    : { type: 'string', ...(query === 'date' ? { format: 'date' } : {}) },
            });
        if (endpoint.idempotent)
            parameters.push({
                in: 'header',
                name: 'Idempotency-Key',
                required: true,
                schema: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 128,
                    pattern: '^[!-~]+$',
                },
                example: 'example-request-001',
                description:
                    'Same identity/key/body replays the original operation; a changed body conflicts. Preserve this key on timeout retries.',
            });
        if (endpoint.access === 'WEBHOOK')
            parameters.push({
                in: 'header',
                name: 'X-Cinema-Signature',
                required: true,
                schema: { type: 'string', pattern: '^[a-f0-9]{64}$' },
                description:
                    'HMAC-SHA256 hex over JSON.stringify([bookingId,paymentReference,transactionId,amount.toFixed(2),currency,status,timestamp]). Timestamp tolerance is 300 seconds. Use the local simulator CLI; never put its secret into browser code.',
            });
        const responseExample = exampleForSchema(endpoint.response);
        const success = {
            description: endpoint.created
                ? 'Created; hold retries may return 200 instead of 201.'
                : 'Operation successful.',
            content: {
                'application/json': {
                    schema: responseSchema(endpoint),
                    example: {
                        code: endpoint.created ? 201 : 200,
                        message: 'Success',
                        data: endpoint.paginated ? [responseExample] : responseExample,
                        ...(endpoint.paginated
                            ? { pagination: { page: 1, limit: 20, total: 1 } }
                            : {}),
                    },
                },
            },
        };
        const responses: Record<string, OpenApiResponse> = {
            [endpoint.created ? '201' : '200']: success,
        };
        if (endpoint.id === 'hold')
            responses['200'] = {
                ...success,
                description: 'Idempotent replay of the original booking.',
                content: {
                    'application/json': {
                        schema: responseSchema({ ...endpoint, created: false }),
                        example: { code: 200, message: 'Success.', data: responseExample },
                    },
                },
            };
        const errors: Record<number, string> = {
            400: 'Invalid body, identifier or query.',
            401: 'Missing/invalid Cinema token or webhook signature.',
            403: 'The authenticated account does not have this role.',
            404: 'Resource missing or belongs to another customer.',
            409: 'Seat unavailable, overlap, state conflict or idempotency mismatch.',
            422: 'Empty/inconsistent business request.',
            429: 'Authentication request rate limit exceeded.',
            500: 'Internal error; sensitive details are omitted.',
            503: 'Database/provider unavailable. Unknown payment outcomes remain pending; retry idempotent operations with the same key.',
        };
        const relevant = new Set([400, 500, 503]);
        if (endpoint.access !== 'PUBLIC' || endpoint.id === 'login') relevant.add(401);
        if (['CUSTOMER', 'ADMIN'].includes(endpoint.access)) relevant.add(403);
        if (
            endpoint.path.includes(':id') ||
            ['createRoom', 'createShowtime', 'hold', 'webhook'].includes(endpoint.id)
        )
            relevant.add(404);
        if (
            [
                'register',
                'createMovie',
                'updateMovie',
                'createCinema',
                'createRoom',
                'createShowtime',
                'hold',
                'cancel',
                'startPayment',
                'webhook',
            ].includes(endpoint.id)
        )
            relevant.add(409);
        if (endpoint.id === 'webhook') relevant.add(422);
        if (['register', 'login'].includes(endpoint.id)) relevant.add(429);
        for (const [code, description] of Object.entries(errors)) {
            if (!relevant.has(Number(code))) continue;
            responses[code] = {
                description,
                content: {
                    'application/json': {
                        schema: ref('Error'),
                        example: { code: Number(code), message: description, data: null },
                    },
                },
            };
        }
        const path = endpoint.path.replace(/:([A-Za-z]+)/g, '{$1}');
        const operations = (paths[path] ??= {});
        operations[endpoint.method] = {
            operationId: endpoint.id,
            tags: [endpoint.tag],
            summary: endpoint.summary,
            description: `${endpoint.summary}. ${endpoint.access === 'PUBLIC' ? 'Public access.' : endpoint.access === 'WEBHOOK' ? 'Provider HMAC verification required.' : `Requires ${endpoint.access} Cinema access; legacy admin tokens are not accepted.`} Business state transitions are executed through the documented stored procedures. All examples are illustrative.`,
            parameters,
            security: ['PUBLIC', 'WEBHOOK'].includes(endpoint.access) ? [] : [{ CinemaBearer: [] }],
            ...(endpoint.body
                ? {
                      requestBody: {
                          required: endpoint.id !== 'startPayment',
                          content: {
                              'application/json': {
                                  schema: ref(endpoint.body),
                                  example: exampleForSchema(endpoint.body),
                              },
                          },
                      },
                  }
                : {}),
            responses,
        };
    }
    return {
        openapi: '3.0.3',
        info: {
            title: 'TROOND Cinema API',
            version: '1.0.0',
            description:
                'Additive Cinema API. SQL Server owns reservations and money/ticket state transitions. Holds default to seven minutes. Prices use VND. Payment simulator is restricted to development/test; production requires a real provider integration.',
        },
        servers: [{ url: base.endsWith('/api/v1') ? base : base + '/api/v1' }],
        tags: [
            'Authentication',
            'Movies',
            'Cinemas',
            'Screening Rooms',
            'Showtimes',
            'Seat Reservations',
            'Bookings',
            'Payments',
            'Tickets',
            'Admin Dashboard',
            'Transaction Monitoring',
        ].map((name) => ({ name })),
        paths,
        components: {
            securitySchemes: {
                CinemaBearer: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description:
                        'Cinema token issued by /cinema/auth/login or register; never a legacy /auth/login token.',
                },
            },
            schemas: cinemaSchemas,
        },
    };
}
