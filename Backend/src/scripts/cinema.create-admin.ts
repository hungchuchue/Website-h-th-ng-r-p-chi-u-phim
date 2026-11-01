import { createCinemaAuthRepository } from '../repositories/cinema.auth.repository';
import { loadEnvironment, namedArguments, readHidden, reportCliError } from './cinema.common';

import { closeCinemaPool } from '../config/cinema.database';
import { hashCinemaPassword } from '../services/cinema.auth.service';
import * as v from '../utils/cinema.validation';
async function main(): Promise<void> {
    loadEnvironment();
    const args = namedArguments(['email', 'name']);
    if (!args.email)
        throw new Error(
            'Provide --email and optionally --name. Password is entered interactively.',
        );
    const email = v.email(args.email),
        name = v.text(args.name || 'Cinema Administrator', 'name', 120);
    const password = v.password(await readHidden('New Cinema ADMIN password: '), true);
    if (password !== (await readHidden('Confirm password: ')))
        throw new Error('Passwords do not match');
    const repo = createCinemaAuthRepository();
    if (await repo.find(email, 'ADMIN'))
        throw new Error('Existing administrator will not be overwritten');
    const account = await repo.create(email, await hashCinemaPassword(password), name, 'ADMIN');
    console.log(JSON.stringify({ id: account.id, email: account.email, role: 'ADMIN' }));
}
main()
    .catch(reportCliError)
    .finally(() => closeCinemaPool().catch(() => {}));
