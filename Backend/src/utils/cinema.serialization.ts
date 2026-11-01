export function sqlBigIntString(value: string | bigint | number): string {
    if (typeof value === 'number' && !Number.isSafeInteger(value))
        throw new Error('Unsafe SQL BIGINT value; a precise string is required.');
    return String(value);
}
