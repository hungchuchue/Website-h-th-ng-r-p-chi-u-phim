"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCodeRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.giftCodeRepository = {
    async getGiftCode(giftCode) {
        const result = await database_1.default.query('SELECT * FROM gift_codes WHERE code = $1 AND is_active = true', [giftCode]);
        return result.rows[0] || null;
    },
    async incrementUses(giftCode) {
        await database_1.default.query('UPDATE gift_codes SET uses_count = uses_count + 1 WHERE code = $1', [giftCode]);
    }
};
