export interface CinemaSettings {
    enabled: boolean;
    environment: string;
    holdMinutes: number;
    jwtSecret: string;
    issuer: 'troond-cinema';
    audience: 'troond-cinema-api';
    jwtTtl: number;
    workers: boolean;
    simulatorSecret: string;
    paymentProvider: string;
    baseUrl: string;
}
