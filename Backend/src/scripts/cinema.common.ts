import dotenv from 'dotenv';
import { AppError } from '../utils/logger';
import { resolve } from 'node:path';
import { backendRoot } from '../config/backend-path';
export function loadEnvironment() {
    dotenv.config({ path: resolve(backendRoot(), '.env'), quiet: true });
}
export function reportCliError<T>(error: T) {
    const e = error instanceof Error ? error : new Error('Unknown error');
    const safe =
        error instanceof AppError ||
        /^(Missing SQL Server|CINEMA_|Migration|Schema|Database|Refusing|SQL Server schema|Existing |No SQL Server|Not connected|A terminal|Passwords |Invalid |Unknown argument|Provide )/.test(
            e.message,
        );
    const code =
        error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
    console.error(
        safe
            ? e.message
            : `Cinema command failed (${code}). Check configuration, permissions and SQL Server availability; connection details omitted.`,
    );
    process.exitCode = 1;
}
export function namedArguments(allowed: string[]): Record<string, string> {
    const args = process.argv.slice(2),
        result: Record<string, string> = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i]?.replace(/^--/, '');
        const value = args[i + 1];
        if (!key || !allowed.includes(key) || value === undefined)
            throw new Error('Unknown argument or missing argument value');
        result[key] = value;
    }
    return result;
}
export async function readHidden(prompt: string): Promise<string> {
    if (!process.stdin.isTTY || !process.stdout.isTTY)
        throw new Error('A terminal is required to enter a password securely.');
    process.stdout.write(prompt);
    const wasRaw = process.stdin.isRaw;
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return new Promise((resolve, reject) => {
        let value = '';
        const finish = (error?: Error) => {
            process.stdin.off('data', onData);
            process.stdin.setRawMode(wasRaw);
            process.stdin.pause();
            process.stdout.write('\n');
            error ? reject(error) : resolve(value);
        };
        const onData = (chunk: string) => {
            if (chunk.includes('\u0003')) return finish(new Error('Invalid input: cancelled'));
            if (chunk === '\r' || chunk === '\n') return finish();
            if (chunk === '\u007f' || chunk === '\b') {
                value = [...value].slice(0, -1).join('');
                return;
            }
            if (!/[\u0000-\u001f\u007f]/.test(chunk)) value += chunk;
        };
        process.stdin.on('data', onData);
    });
}
