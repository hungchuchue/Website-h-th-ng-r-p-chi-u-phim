import {
    cinemaStore,
    sql,
    requireSqlRow,
    type CinemaStore,
} from './cinema.store.repository';
import type { AccountRow, CinemaRole } from '../types/cinema.types';
import type { AccountsRepository } from '../types/cinema.repository.types';
export type { AccountsRepository } from '../types/cinema.repository.types';
import { decodeAccount } from './cinema.sql.mapper';

function table(role: CinemaRole): string {
    return role === 'ADMIN' ? 'dbo.QUAN_TRI_VIEN' : 'dbo.KHACH_HANG';
}
export function createCinemaAuthRepository(db: CinemaStore = cinemaStore): AccountsRepository {
    return {
        db,
        async find(email: string, role: CinemaRole): Promise<AccountRow | undefined> {
            return (
                await db.query<AccountRow>(
                    `SELECT id,email,mat_khau,ho_ten,dang_hoat_dong FROM ${table(role)} WHERE email=@email`,
                    decodeAccount,
                    (r) => r.input('email', sql.NVarChar(254), email),
                )
            )[0];
        },
        async byId(id: number, role: CinemaRole): Promise<AccountRow | undefined> {
            return (
                await db.query<AccountRow>(
                    `SELECT id,email,mat_khau,ho_ten,dang_hoat_dong FROM ${table(role)} WHERE id=@id`,
                    decodeAccount,
                    (r) => r.input('id', sql.Int, id),
                )
            )[0];
        },
        async create(
            email: string,
            hash: string,
            name: string,
            role: CinemaRole = 'CUSTOMER',
        ): Promise<AccountRow> {
            return requireSqlRow(
                await db.query<AccountRow>(
                    `INSERT ${table(role)}(email,mat_khau,ho_ten) OUTPUT inserted.id,inserted.email,inserted.mat_khau,inserted.ho_ten,inserted.dang_hoat_dong VALUES(@email,@hash,@name)`,
                    decodeAccount,
                    (r) =>
                        r
                            .input('email', sql.NVarChar(254), email)
                            .input('hash', sql.VarChar(256), hash)
                            .input('name', sql.NVarChar(120), name),
                ),
            );
        },
    };
}

export const cinemaAuthRepository: AccountsRepository = createCinemaAuthRepository();
