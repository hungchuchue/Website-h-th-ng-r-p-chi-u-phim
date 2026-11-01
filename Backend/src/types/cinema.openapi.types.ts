import type { JsonValue, JsonPrimitive } from './cinema.input.types';
export interface OpenApiSchema {
    $ref?: string;
    type?: string;
    format?: string;
    description?: string;
    example?: JsonValue;
    default?: JsonValue;
    nullable?: boolean;
    minimum?: number;
    maximum?: number;
    multipleOf?: number;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    minProperties?: number;
    pattern?: string;
    writeOnly?: boolean;
    additionalProperties?: boolean;
    enum?: readonly JsonPrimitive[];
    properties?: Record<string, OpenApiSchema>;
    required?: string[];
    items?: OpenApiSchema;
}
export interface OpenApiParameter {
    in: 'path' | 'query' | 'header';
    name: string;
    required?: boolean;
    schema: OpenApiSchema;
    description: string;
    example?: JsonValue;
}
export interface OpenApiMedia {
    schema: OpenApiSchema;
    example?: JsonValue;
}
export interface OpenApiResponse {
    description: string;
    content: Record<string, OpenApiMedia>;
}
export interface OpenApiOperation {
    operationId: string;
    tags: string[];
    summary: string;
    description: string;
    parameters: OpenApiParameter[];
    security: Record<string, string[]>[];
    requestBody?: {
        required: boolean;
        content: Record<string, OpenApiMedia>;
    };
    responses: Record<string, OpenApiResponse>;
}
export type OpenApiPaths = Record<
    string,
    Partial<Record<'get' | 'post' | 'patch', OpenApiOperation>>
>;
export interface CinemaOpenApiDocument {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
    };
    servers: {
        url: string;
    }[];
    tags: {
        name: string;
    }[];
    paths: OpenApiPaths;
    components: {
        securitySchemes: Record<
            string,
            {
                type: string;
                scheme: string;
                bearerFormat: string;
                description: string;
            }
        >;
        schemas: Record<string, OpenApiSchema>;
    };
}
