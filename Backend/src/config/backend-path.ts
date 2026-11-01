import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
export function backendRoot(fromDirectory = __dirname): string {
  const sourceRoot = resolve(fromDirectory, '../..');
  return existsSync(resolve(sourceRoot, 'package.json'))
    ? sourceRoot
    : resolve(fromDirectory, '../../..');
}
