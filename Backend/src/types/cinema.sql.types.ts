import type sql from 'mssql';

export type SqlScalar = string | number | bigint | boolean | Date | Buffer | null | undefined;
export interface SqlRow {
    [column: string]: SqlScalar;
}
export type SqlRowDecoder<T> = (row: SqlRow) => T;
export type Bind = (request: sql.Request) => sql.Request;
export interface CinemaStore {
    readonly pool: () => Promise<sql.ConnectionPool>;
    query<T>(statement: string, decode: SqlRowDecoder<T>, bind?: Bind): Promise<T[]>;
    execute<T>(procedure: string, decode: SqlRowDecoder<T>, bind?: Bind): Promise<T[]>;
    queryCommand(statement: string, bind?: Bind): Promise<void>;
    executeCommand(procedure: string, bind?: Bind): Promise<void>;
}
