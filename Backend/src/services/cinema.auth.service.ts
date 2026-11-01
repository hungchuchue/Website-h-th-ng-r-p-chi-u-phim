import {
    cinemaAuthRepository,
    type AccountsRepository,
} from '../repositories/cinema.auth.repository';
import type { RegisterBody, LoginBody } from '../types/cinema.input.types';
import type { AccountDto, AuthDto, CinemaJwtClaims } from '../types/cinema.auth.types';
import type { CinemaInput } from '../types/cinema.input.types';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/logger';
import { requireCinemaJwt } from '../config/cinema';
import type { AccountRow, CinemaIdentity, CinemaRole } from '../types/cinema.types';
import * as v from '../utils/cinema.validation';
let dummy: Promise<string> | undefined;
export function hashCinemaPassword(password: string): Promise<string> {
    return argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
    });
}
export function accountDto(row: AccountRow, role: CinemaRole): AccountDto {
    return { id: row.id, email: row.email, displayName: row.ho_ten, role };
}

export interface CinemaAuthService {
    readonly accounts: Pick<AccountsRepository, 'find' | 'byId' | 'create'>;
    register(body: CinemaInput): Promise<AuthDto>;
    login(body: CinemaInput): Promise<AuthDto>;
    authenticate(header: string | undefined): Promise<CinemaIdentity>;
    me(identity: CinemaIdentity): Promise<AccountDto>;
}

function tokens(row: AccountRow, role: CinemaRole): AuthDto {
    const c = requireCinemaJwt();
    return {
        accessToken: jwt.sign({ role, userId: row.id, type: 'access' }, c.jwtSecret, {
            algorithm: 'HS256',
            subject: `${role}:${row.id}`,
            issuer: c.issuer,
            audience: c.audience,
            expiresIn: c.jwtTtl,
            jwtid: randomUUID(),
        }),
        tokenType: 'Bearer',
        expiresIn: c.jwtTtl,
        user: accountDto(row, role),
    };
}

export function createCinemaAuthService(
    accounts: Pick<AccountsRepository, 'find' | 'byId' | 'create'> = cinemaAuthRepository,
): CinemaAuthService {
    const service: CinemaAuthService = {
        accounts,

        async register(body: CinemaInput): Promise<AuthDto> {
            const data = v.object(body, ['email', 'password', 'displayName']);
            const email = v.email(data.email),
                password = v.password(data.password, true),
                name =
                    data.displayName === undefined
                        ? (email.split('@')[0] ?? '').slice(0, 120)
                        : v.text(data.displayName, 'displayName', 120);
            const request: RegisterBody = { email, password, displayName: name };
            requireCinemaJwt();
            const hash = await hashCinemaPassword(request.password);
            return tokens(
                await accounts.create(request.email, hash, request.displayName ?? name),
                'CUSTOMER',
            );
        },

        async login(body: CinemaInput): Promise<AuthDto> {
            const data = v.object(body, ['email', 'password', 'accountType']);
            const email = v.email(data.email),
                password = v.password(data.password),
                role =
                    data.accountType === undefined
                        ? 'CUSTOMER'
                        : v.choice(data.accountType, ['CUSTOMER', 'ADMIN'] as const, 'accountType');
            requireCinemaJwt();
            const request: LoginBody = { email, password, accountType: role };
            const row = await accounts.find(request.email, role);
            dummy ??= hashCinemaPassword('dummy-password-that-is-never-an-account');
            const hash = row?.mat_khau ?? (await dummy);
            let valid = false;
            try {
                valid =
                    hash.startsWith('$argon2id$') && (await argon2.verify(hash, request.password));
            } catch {
                valid = false;
            }
            if (!row || !row.dang_hoat_dong || !valid)
                throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
            return tokens(row, role);
        },

        async authenticate(header: string | undefined): Promise<CinemaIdentity> {
            if (!header || !/^Bearer [^ ]+$/.test(header))
                throw new AppError(401, 'UNAUTHORIZED', 'A Cinema Bearer token is required.');
            const c = requireCinemaJwt();
            let identity: CinemaIdentity;
            try {
                const decoded = jwt.verify(header.slice(7), c.jwtSecret, {
                    algorithms: ['HS256'],
                    issuer: c.issuer,
                    audience: c.audience,
                });
                if (
                    typeof decoded === 'string' ||
                    (decoded.role !== 'CUSTOMER' && decoded.role !== 'ADMIN') ||
                    typeof decoded.userId !== 'number' ||
                    !Number.isInteger(decoded.userId) ||
                    decoded.userId < 1 ||
                    decoded.userId > 2147483647 ||
                    decoded.type !== 'access' ||
                    decoded.sub !== `${decoded.role}:${decoded.userId}`
                )
                    throw new Error('Invalid claims');
                const claims: CinemaJwtClaims = {
                    role: decoded.role,
                    userId: decoded.userId,
                    type: decoded.type,
                    sub: decoded.sub,
                };
                identity = { id: claims.userId, role: claims.role };
            } catch {
                throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired Cinema token.');
            }
            const row = await accounts.byId(identity.id, identity.role);
            if (!row || !row.dang_hoat_dong)
                throw new AppError(401, 'UNAUTHORIZED', 'The Cinema account is not active.');
            return identity;
        },

        async me(identity: CinemaIdentity): Promise<AccountDto> {
            const row = await accounts.byId(identity.id, identity.role);
            if (!row || !row.dang_hoat_dong)
                throw new AppError(401, 'UNAUTHORIZED', 'Account is not active.');
            return accountDto(row, identity.role);
        },
    };

    return service;
}

export const cinemaAuthService = createCinemaAuthService();
