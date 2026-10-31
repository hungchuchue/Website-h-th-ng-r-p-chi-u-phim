"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIsNumberId = exports.hashPassword = void 0;
exports.verifyPassword = verifyPassword;
const crypto_1 = __importDefault(require("crypto"));
const hashPassword = (password) => {
    const SALT = 'iuBred7xZFNlaP6ygiTeB3kd2ATINGRo4R0byYCjHgG';
    return crypto_1.default.pbkdf2Sync(password, SALT, 1000, 64, 'sha256').toString('hex');
};
exports.hashPassword = hashPassword;
async function verifyPassword(password, storedHash) {
    // Keep compatibility with the legacy hash produced by hashPassword.
    if (/^[0-9a-f]{128}$/i.test(storedHash)) {
        return crypto_1.default.timingSafeEqual(Buffer.from((0, exports.hashPassword)(password), 'hex'), Buffer.from(storedHash, 'hex'));
    }
    const match = storedHash.match(/^pbkdf2_sha256\$(\d+)\$([^$]+)\$([A-Za-z0-9_-]{43})$/);
    if (!match)
        return false;
    const iterations = Number(match[1]);
    if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 2_000_000)
        return false;
    const salt = match[2];
    const expected = Buffer.from(match[3], 'base64url');
    if (expected.length !== 32 || expected.toString('base64url') !== match[3])
        return false;
    const actual = await new Promise((resolve, reject) => {
        crypto_1.default.pbkdf2(password, salt, iterations, expected.length, 'sha256', (error, result) => {
            if (error)
                reject(error);
            else
                resolve(result);
        });
    });
    return crypto_1.default.timingSafeEqual(actual, expected);
}
const checkIsNumberId = (id) => {
    // 1. Kiểm tra xem chuỗi có phải chỉ chứa các ký số từ 0-9 hay không
    const isPureDigits = /^\d+$/.test(id);
    if (!isPureDigits)
        return false;
    // 2. Chặn các số quá dài có thể gây tràn số JS hoặc tràn số DB (INTEGER tối đa 10 chữ số)
    if (id.length > 10)
        return false;
    // 3. Nếu là số hợp lệ, ép kiểu về number và check > 0
    const num = Number(id);
    return num > 0 && num <= 2147483647; // Tối đa của INT trong DB
};
exports.checkIsNumberId = checkIsNumberId;
//# sourceMappingURL=validation.js.map