import { createCinemaBookingRepository } from '../repositories/cinema.booking.repository';
import { loadEnvironment, namedArguments, reportCliError } from './cinema.common';
import { cinemaSettings } from '../config/cinema';
import { paymentGateway, parseCallback, signCallback } from '../lib/cinema.simulator';

import { closeCinemaPool } from '../config/cinema.database';
import { randomUUID } from 'node:crypto';
async function main(): Promise<void> {
    loadEnvironment();
    const args = namedArguments(['reference', 'status', 'transaction-id']);
    if (!args.reference)
        throw new Error('Provide --reference and --status SUCCESS, FAILED or UNKNOWN.');
    paymentGateway();
    const p = await createCinemaBookingRepository().paymentByReference(args.reference);
    if (!p) throw new Error('Invalid payment reference');
    const callback = parseCallback({
        bookingId: p.id_don_hang,
        paymentReference: p.ma_yeu_cau,
        transactionId: args['transaction-id'] || `SIM-${randomUUID()}`,
        amount: p.so_tien,
        currency: 'VND',
        status: args.status || 'SUCCESS',
        timestamp: Math.floor(Date.now() / 1000),
    });
    const c = cinemaSettings();
    const response = await fetch(new URL('/api/v1/webhooks/payments/simulator', c.baseUrl), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Cinema-Signature': signCallback(callback, c.simulatorSecret),
        },
        body: JSON.stringify(callback),
        signal: AbortSignal.timeout(20000),
    });
    console.log('Simulator callback HTTP', response.status);
    console.log(await response.text());
    if (!response.ok) process.exitCode = 1;
}
main()
    .catch(reportCliError)
    .finally(() => closeCinemaPool().catch(() => {}));
