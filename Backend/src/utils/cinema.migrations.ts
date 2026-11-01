import type { SchemaRecordsets, CinemaMigrationStatus } from '../types/cinema.database.types';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sql from 'mssql';
import { backendRoot } from '../config/backend-path';
export const cinemaTables = [
    'KHACH_HANG',
    'QUAN_TRI_VIEN',
    'PHIM',
    'CUM_RAP',
    'PHONG_CHIEU',
    'GHE',
    'SUAT_CHIEU',
    'DON_HANG',
    'CHI_TIET_DON_HANG',
    'GHE_SUAT_CHIEU',
    'THANH_TOAN',
    'VE',
    'BUOC_GIAO_DICH',
    'OUTBOX_SU_KIEN',
] as const;
export const cinemaProcedures = [
    'sp_tao_suat_chieu',
    'sp_tao_don_va_giu_ghe',
    'sp_bat_dau_thanh_toan',
    'sp_xu_ly_ket_qua_thanh_toan',
    'sp_phat_hanh_ve',
    'sp_giai_phong_ghe_het_han',
    'sp_huy_don_chua_thanh_toan',
    'sp_xac_nhan_hoan_tien',
] as const;
function firstMetadataRow<T>(rows: readonly T[]): T {
    const row = rows[0];
    if (row === undefined) throw new Error('Migration metadata result row is missing.');
    return row;
}
const prefix = 'troond.cinema.migration.',
    fingerprintKey = 'troond.cinema.schema';
const checksum = (data: string) => createHash('sha256').update(data).digest('hex');
export async function migrationFiles(directory = resolve(backendRoot(), 'migrations/cinema')) {
    const names = (await readdir(directory))
        .filter((n) => /^\d{3}_[a-z0-9_]+\.sql$/.test(n))
        .sort();
    if (names.length < 10 || !names.every((name, index) => Number(name.slice(0, 3)) === index + 1))
        throw new Error(
            'Migration directory must contain the initial ten Cinema migrations in contiguous numeric order',
        );
    return Promise.all(
        names.map(async (name) => {
            const source = await readFile(resolve(directory, name), 'utf8');
            if (
                /^\s*GO\s*$/im.test(source) ||
                /\b(?:DROP\s+(?:DATABASE|TABLE)|CREATE\s+DATABASE)\b/i.test(source)
            )
                throw new Error(
                    `Migration contains an unsupported batch separator or destructive statement: ${name}`,
                );
            return { name, source, checksum: checksum(source) };
        }),
    );
}
export async function inspectCinemaObjects(request: sql.Request) {
    const result = await request.query<{
        name: string;
        type: string;
    }>(
        "SELECT name,type FROM sys.objects WHERE schema_id=SCHEMA_ID('dbo') AND type IN('U','P') UNION ALL SELECT name,'TT' type FROM sys.table_types WHERE schema_id=SCHEMA_ID('dbo')",
    );
    const present = new Set(result.recordset.map((x) => `${x.type.trim()}:${x.name}`));
    const missing = [
        ...cinemaTables.filter((n) => !present.has(`U:${n}`)),
        ...cinemaProcedures.filter((n) => !present.has(`P:${n}`)),
        ...(!present.has('TT:DanhSachGhe') ? ['DanhSachGhe'] : []),
    ];
    return {
        tables: cinemaTables.filter((n) => present.has(`U:${n}`)),
        procedures: cinemaProcedures.filter((n) => present.has(`P:${n}`)),
        tableType: present.has('TT:DanhSachGhe'),
        missing,
    };
}
async function properties(request: sql.Request) {
    return (
        await request.query<{
            name: string;
            value: string;
        }>(
            "SELECT name,CONVERT(VARCHAR(128),value) value FROM sys.extended_properties WHERE class=3 AND major_id=SCHEMA_ID('dbo') AND(name LIKE 'troond.cinema.migration.%' OR name='troond.cinema.schema') ORDER BY name",
        )
    ).recordset;
}
export async function schemaFingerprint(request: sql.Request): Promise<string> {
    const names = [...cinemaTables, ...cinemaProcedures, 'DanhSachGhe'];
    const result = await request.input('names', sql.NVarChar(sql.MAX), JSON.stringify(names))
        .query<SchemaRecordsets>(`
 SELECT o.name,o.type,c.column_id,c.name column_name,t.name type_name,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,dc.definition default_definition,cc.definition computed_definition
 FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id LEFT JOIN sys.columns c ON c.object_id=o.object_id LEFT JOIN sys.types t ON t.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id
 WHERE s.name='dbo' AND o.name IN(SELECT value FROM OPENJSON(@names)) ORDER BY o.name,c.column_id;
 SELECT o.name,m.definition FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE o.schema_id=SCHEMA_ID('dbo') AND o.name IN(SELECT value FROM OPENJSON(@names)) ORDER BY o.name;
 SELECT o.name,ck.name constraint_name,ck.definition,ck.is_disabled,ck.is_not_trusted FROM sys.check_constraints ck JOIN sys.objects o ON o.object_id=ck.parent_object_id WHERE o.schema_id=SCHEMA_ID('dbo') AND o.name IN(SELECT value FROM OPENJSON(@names)) ORDER BY o.name,ck.name;
 SELECT o.name,i.name index_name,i.is_unique,i.is_primary_key,i.is_disabled,i.filter_definition,ic.key_ordinal,ic.index_column_id,ic.is_included_column,ic.is_descending_key,c.name column_name FROM sys.indexes i JOIN sys.objects o ON o.object_id=i.object_id JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE o.schema_id=SCHEMA_ID('dbo') AND o.name IN(SELECT value FROM OPENJSON(@names)) ORDER BY o.name,i.name,ic.index_column_id;
 SELECT o.name,fk.name constraint_name,fk.is_disabled,fk.is_not_trusted,fk.delete_referential_action,fk.update_referential_action,fkc.constraint_column_id,pc.name parent_column,ro.name referenced_table,rc.name referenced_column FROM sys.foreign_keys fk JOIN sys.objects o ON o.object_id=fk.parent_object_id JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id JOIN sys.columns pc ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id JOIN sys.objects ro ON ro.object_id=fkc.referenced_object_id JOIN sys.columns rc ON rc.object_id=fkc.referenced_object_id AND rc.column_id=fkc.referenced_column_id WHERE o.schema_id=SCHEMA_ID('dbo') AND o.name IN(SELECT value FROM OPENJSON(@names)) ORDER BY o.name,fk.name,fkc.constraint_column_id;
 SELECT tt.name,c.column_id,c.name column_name,t.name type_name,c.max_length,c.is_nullable,i.name index_name,i.is_unique,ic.key_ordinal FROM sys.table_types tt JOIN sys.columns c ON c.object_id=tt.type_table_object_id JOIN sys.types t ON t.user_type_id=c.user_type_id LEFT JOIN sys.index_columns ic ON ic.object_id=c.object_id AND ic.column_id=c.column_id LEFT JOIN sys.indexes i ON i.object_id=ic.object_id AND i.index_id=ic.index_id WHERE tt.schema_id=SCHEMA_ID('dbo') AND tt.name='DanhSachGhe' ORDER BY c.column_id,i.name;`);
    return checksum(JSON.stringify(result.recordsets));
}
async function setProperty(transaction: sql.Transaction, name: string, value: string) {
    const request = transaction.request();
    const exists = await request.input('name', sql.NVarChar(128), name).query<{
        present: number;
    }>("SELECT COUNT(*) present FROM sys.extended_properties WHERE class=3 AND major_id=SCHEMA_ID('dbo') AND name=@name");
    await transaction
        .request()
        .input('name', sql.NVarChar(128), name)
        .input('value', sql.VarChar(128), value)
        .query(
            `EXEC sys.${firstMetadataRow(exists.recordset).present ? 'sp_updateextendedproperty' : 'sp_addextendedproperty'} @name=@name,@value=@value,@level0type=N'SCHEMA',@level0name=N'dbo'`,
        );
}
export async function migrationStatus(pool: sql.ConnectionPool): Promise<CinemaMigrationStatus> {
    const files = await migrationFiles(),
        props = await properties(pool.request());
    const map = new Map(props.map((p) => [p.name, p.value]));
    const expected = map.get(fingerprintKey);
    const actual = expected ? await schemaFingerprint(pool.request()) : undefined;
    return {
        drift: expected !== undefined && expected !== actual,
        migrations: files.map((f) => ({
            name: f.name,
            status: map.has(prefix + f.name)
                ? map.get(prefix + f.name) === f.checksum
                    ? 'applied'
                    : 'checksum_mismatch'
                : 'pending',
        })),
        objects: await inspectCinemaObjects(pool.request()),
    };
}
export async function runMigrations(pool: sql.ConnectionPool): Promise<void> {
    if (
        process.env.NODE_ENV === 'production' ||
        !['development', 'test'].includes(process.env.CINEMA_MIGRATION_TARGET || '')
    )
        throw new Error(
            'Refusing migration: set CINEMA_MIGRATION_TARGET=development or test on a dedicated database; production execution is disabled.',
        );
    const target = await pool.request().query<{
        version: number;
        compatibility: number;
    }>("SELECT CONVERT(INT,SERVERPROPERTY('ProductMajorVersion')) version,compatibility_level compatibility FROM sys.databases WHERE database_id=DB_ID()");
    if (
        !target.recordset[0] ||
        target.recordset[0].version < 15 ||
        target.recordset[0].compatibility < 150
    )
        throw new Error(
            'Database must use SQL Server 2019+ with compatibility level 150 or higher',
        );
    const files = await migrationFiles();
    for (const file of files) {
        const transaction = new sql.Transaction(pool);
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        try {
            const lock = await transaction.request().query<{
                result: number;
            }>("DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource=N'troond-cinema-migrations',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; SELECT @r result;");
            if (firstMetadataRow(lock.recordset).result < 0)
                throw new Error('Migration lock could not be acquired');
            const props = new Map(
                (await properties(transaction.request())).map((p) => [p.name, p.value]),
            );
            if (
                props.has(fingerprintKey) &&
                props.get(fingerprintKey) !== (await schemaFingerprint(transaction.request()))
            )
                throw new Error(
                    'Schema drift detected. No migration was applied; inspect changed objects first.',
                );
            if (props.has(prefix + file.name)) {
                if (props.get(prefix + file.name) !== file.checksum)
                    throw new Error(`Migration checksum mismatch: ${file.name}`);
            } else {
                const index = files.indexOf(file);
                if (files.slice(index + 1).some((f) => props.has(prefix + f.name)))
                    throw new Error('Migration history is out of order');
                const proc = file.source.match(
                    /CREATE\s+OR\s+ALTER\s+PROCEDURE\s+dbo\.(sp_[a-z0-9_]+)/i,
                )?.[1];
                if (proc) {
                    const existing = await transaction
                        .request()
                        .input('name', sql.NVarChar(128), proc)
                        .query<{
                            present: number;
                        }>("SELECT COUNT(*) present FROM sys.procedures WHERE schema_id=SCHEMA_ID('dbo') AND name=@name");
                    if (
                        firstMetadataRow(existing.recordset).present &&
                        !files
                            .slice(0, index)
                            .some(
                                (previous) =>
                                    props.has(prefix + previous.name) &&
                                    previous.source.match(
                                        /CREATE\s+OR\s+ALTER\s+PROCEDURE\s+dbo\.(sp_[a-z0-9_]+)/i,
                                    )?.[1] === proc,
                            )
                    )
                        throw new Error(
                            `Existing procedure has no matching migration history: ${proc}`,
                        );
                }
                await transaction.request().batch<never>(file.source);
                await setProperty(transaction, prefix + file.name, file.checksum);
                await setProperty(
                    transaction,
                    fingerprintKey,
                    await schemaFingerprint(transaction.request()),
                );
            }
            await transaction.commit();
            console.log('[Cinema migration]', file.name, 'applied/verified');
        } catch (error) {
            await transaction.rollback().catch(() => {});
            throw error;
        }
    }
}
