"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupLockscreenAutoPopups = cleanupLockscreenAutoPopups;
const database_1 = __importDefault(require("../config/database"));
async function cleanupLockscreenAutoPopups() {
    const lockResult = await database_1.default.query('SELECT pg_try_advisory_lock(44) AS acquired');
    if (!lockResult.rows[0].acquired) {
        return;
    }
    try {
        const retentionDays = 2;
        const result = await database_1.default.query(`DELETE FROM lockscreen_popups
             WHERE mode = 'auto'
               AND scheduled_date < ((NOW() AT TIME ZONE 'UTC')::date - (($1::int - 1) * INTERVAL '1 day'))`, [retentionDays]);
        if ((result.rowCount ?? 0) > 0) {
            console.log(`[LockscreenPopupCleanup] Deleted ${result.rowCount} old auto popups.`);
        }
    }
    finally {
        await database_1.default.query('SELECT pg_advisory_unlock(44)');
    }
}
