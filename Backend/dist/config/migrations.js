"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrate = migrate;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const index_1 = require("./index");
const database_1 = require("./database");
async function migrate() {
    const directory = node_path_1.default.join(index_1.backendRoot, 'migrations');
    const files = (await (0, promises_1.readdir)(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    await (0, database_1.transaction)(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['auth-migrations:' + index_1.config.dbSchema]);
        await client.query('CREATE SCHEMA IF NOT EXISTS ' + database_1.schema);
        await client.query('CREATE TABLE IF NOT EXISTS ' + database_1.schema + '.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
        for (const name of files) {
            const sql = await (0, promises_1.readFile)(node_path_1.default.join(directory, name), 'utf8');
            const checksum = (0, node_crypto_1.createHash)('sha256').update(sql).digest('hex');
            const previous = await client.query('SELECT checksum FROM ' + database_1.schema + '.schema_migrations WHERE name = $1', [name]);
            if (previous.rows[0]) {
                if (previous.rows[0].checksum !== checksum)
                    throw new Error('Applied migration was changed: ' + name);
                continue;
            }
            await client.query(sql.replaceAll('__AUTH_SCHEMA__', database_1.schema));
            await client.query('INSERT INTO ' + database_1.schema + '.schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
        }
    });
}
//# sourceMappingURL=migrations.js.map