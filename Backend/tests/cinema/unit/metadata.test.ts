import assert from 'node:assert/strict';
import { test } from 'node:test';
import sql from 'mssql';
import {
    inspectCinemaObjects,
    cinemaTables,
    cinemaProcedures,
} from '../../../src/utils/cinema.migrations';

test('SQL Server fixed-width object type padding does not incorrectly report a complete schema as missing', async () => {
    const request = new sql.Request();
    const rows = [
        ...cinemaTables.map((name) => ({ name, type: 'U ' })),
        ...cinemaProcedures.map((name) => ({ name, type: 'P ' })),
        { name: 'DanhSachGhe', type: 'TT' },
    ];
    // Stub only this unconnected request instance; the fixture models SQL char(2) metadata.
    Object.defineProperty(request, 'query', {
        value: async () => ({ recordset: rows }),
    });
    const status = await inspectCinemaObjects(request);
    assert.equal(status.tables.length, 14);
    assert.equal(status.procedures.length, 8);
    assert.equal(status.tableType, true);
    assert.deepEqual(status.missing, []);
});
