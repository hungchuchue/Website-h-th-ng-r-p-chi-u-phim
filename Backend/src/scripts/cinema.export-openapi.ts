import { loadEnvironment, reportCliError } from './cinema.common';
import { cinemaOpenApi } from '../config/cinema.openapi';
import { backendRoot } from '../config/backend-path';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
async function main(): Promise<void> {
    loadEnvironment();
    const directory = resolve(backendRoot(), 'guide/cinema');
    await mkdir(directory, { recursive: true });
    await writeFile(
        resolve(directory, 'openapi.json'),
        JSON.stringify(cinemaOpenApi(), null, 2) + '\n',
    );
    console.log('Wrote guide/cinema/openapi.json; existing Swagger files were not modified.');
}
main().catch(reportCliError);
