import crypto from 'crypto';


export const hashPassword = (password: string) => {
    const SALT = 'iuBred7xZFNlaP6ygiTeB3kd2ATINGRo4R0byYCjHgG';
    return crypto.pbkdf2Sync(password, SALT, 1000, 64, 'sha256').toString('hex');
};

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    // Keep compatibility with the legacy hash produced by hashPassword.
    if (/^[0-9a-f]{128}$/i.test(storedHash)) {
        return crypto.timingSafeEqual(
            Buffer.from(hashPassword(password), 'hex'),
            Buffer.from(storedHash, 'hex'),
        );
    }

    const match = storedHash.match(/^pbkdf2_sha256\$(\d+)\$([^$]+)\$([A-Za-z0-9_-]{43})$/);
    if (!match) return false;

    const iterations = Number(match[1]);
    if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 2_000_000) return false;

    const salt = match[2]!;
    const expected = Buffer.from(match[3]!, 'base64url');
    if (expected.length !== 32 || expected.toString('base64url') !== match[3]) return false;

    const actual = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, expected.length, 'sha256', (error, result) => {
            if (error) reject(error);
            else resolve(result);
        });
    });
    return crypto.timingSafeEqual(actual, expected);
}

export const checkIsNumberId = (id: string) => {
    // 1. Kiểm tra xem chuỗi có phải chỉ chứa các ký số từ 0-9 hay không
    const isPureDigits = /^\d+$/.test(id);
    if (!isPureDigits) return false;

    // 2. Chặn các số quá dài có thể gây tràn số JS hoặc tràn số DB (INTEGER tối đa 10 chữ số)
    if (id.length > 10) return false;

    // 3. Nếu là số hợp lệ, ép kiểu về number và check > 0
    const num = Number(id);
    return num > 0 && num <= 2147483647; // Tối đa của INT trong DB
};