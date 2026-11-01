import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as v from '../../../src/utils/cinema.validation';
import { cinemaEnabled, cinemaSettings, cinemaSqlConfig } from '../../../src/config/cinema';
import { migrationFiles } from '../../../src/utils/cinema.migrations';
test('hold fingerprint normalizes seat order and binds the showtime and seat selection', () => {
    assert.equal(v.holdHash(1, [2, 1]), v.holdHash(1, [1, 2]));
    assert.notEqual(v.holdHash(1, [1]), v.holdHash(2, [1]));
    assert.notEqual(v.holdHash(1, [1]), v.holdHash(1, [2]));
});
test('hold input rejects duplicate, foreign-shaped and overflowing identifiers and untrusted totals', () => {
    for (const x of [[], [1, 1], [0], [2147483648], ['1 OR 1=1'], [1.5]])
        assert.throws(() => v.seatIds(x));
    assert.deepEqual(v.seatIds([2, 1]), [1, 2]);
    assert.throws(() =>
        v.object({ showtimeId: 1, seatIds: [1], totalAmount: 1 }, ['showtimeId', 'seatIds']),
    );
    for (const x of ['', 'with space', 'x'.repeat(129)]) assert.throws(() => v.idempotencyKey(x));
});
test('money and dates are validated without silently normalizing malformed values', () => {
    assert.equal(v.money(0.29), 0.29);
    assert.throws(() => v.money(1.001));
    assert.throws(() => v.money(-1));
    assert.throws(() => v.money(Infinity));
    assert.equal(v.calendarDate('2028-02-29'), '2028-02-29');
    assert.throws(() => v.calendarDate('2026-02-29'));
    assert.throws(() => v.utcDateTime('2026-11-01T12:00:00'));
    assert.equal(
        v.utcDateTime('2026-11-01T12:00:00+07:00').toISOString(),
        '2026-11-01T05:00:00.000Z',
    );
});
test('Cinema stays opt-in and hold duration is bounded to five through ten minutes', () => {
    assert.equal(cinemaEnabled({}), false);
    assert.equal(cinemaSettings({}).holdMinutes, 7);
    assert.throws(() => cinemaSettings({ CINEMA_HOLD_MINUTES: '4' }));
    assert.throws(() => cinemaSettings({ CINEMA_HOLD_MINUTES: '11' }));
    assert.throws(() => cinemaSqlConfig({}), /Missing SQL Server configuration/);
});
test('migration package is ordered and contains ten reviewable batches', async () => {
    const files = await migrationFiles();
    assert.equal(files.length, 10);
    assert.equal(files[0]!.name, '001_schema.sql');
    assert.equal(files[9]!.name, '010_sp_xac_nhan_hoan_tien.sql');
    assert(files.every((f) => /^[a-f0-9]{64}$/.test(f.checksum)));
});
