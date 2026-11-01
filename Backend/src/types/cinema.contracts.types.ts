export type Access = 'PUBLIC' | 'AUTHENTICATED' | 'CUSTOMER' | 'ADMIN' | 'WEBHOOK';
export interface EndpointContract {
    id: string;
    method: 'get' | 'post' | 'patch';
    path: string;
    tag: string;
    summary: string;
    access: Access;
    screens: string[];
    tables: string[];
    procedures: string[];
    body?: string;
    response: string;
    created?: boolean;
    paginated?: boolean;
    idempotent?: boolean;
    queries?: string[];
}
