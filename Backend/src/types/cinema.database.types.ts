export interface Page {
    page: number;
    limit: number;
    offset: number;
}
export interface SchemaColumnRow {
    name: string;
    type: string;
    column_id: number | null;
    column_name: string | null;
    type_name: string | null;
    max_length: number | null;
    precision: number | null;
    scale: number | null;
    is_nullable: boolean | null;
    is_identity: boolean | null;
    default_definition: string | null;
    computed_definition: string | null;
}
export interface SchemaModuleRow {
    name: string;
    definition: string | null;
}
export interface SchemaCheckRow {
    name: string;
    constraint_name: string;
    definition: string | null;
    is_disabled: boolean;
    is_not_trusted: boolean;
}
export interface SchemaIndexRow {
    name: string;
    index_name: string;
    is_unique: boolean;
    is_primary_key: boolean;
    is_disabled: boolean;
    filter_definition: string | null;
    key_ordinal: number;
    index_column_id: number;
    is_included_column: boolean;
    is_descending_key: boolean;
    column_name: string;
}
export interface SchemaForeignKeyRow {
    name: string;
    constraint_name: string;
    is_disabled: boolean;
    is_not_trusted: boolean;
    delete_referential_action: number;
    update_referential_action: number;
    constraint_column_id: number;
    parent_column: string;
    referenced_table: string;
    referenced_column: string;
}
export interface SchemaTableTypeRow {
    name: string;
    column_id: number;
    column_name: string;
    type_name: string;
    max_length: number;
    is_nullable: boolean;
    index_name: string | null;
    is_unique: boolean | null;
    key_ordinal: number | null;
}
export type SchemaRecordsets = [
    SchemaColumnRow,
    SchemaModuleRow,
    SchemaCheckRow,
    SchemaIndexRow,
    SchemaForeignKeyRow,
    SchemaTableTypeRow,
];
export interface CinemaObjectStatus {
    tables: string[];
    procedures: string[];
    tableType: boolean;
    missing: string[];
}
export interface CinemaMigrationStatus {
    drift: boolean;
    migrations: {
        name: string;
        status: 'applied' | 'pending' | 'checksum_mismatch';
    }[];
    objects: CinemaObjectStatus;
}
