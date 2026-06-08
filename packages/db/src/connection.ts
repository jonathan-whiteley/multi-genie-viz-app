import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  // PGHOST/PGDATABASE/PGUSER/PGPASSWORD are auto-injected by the DAB 'database'
  // resource binding at runtime. Fall back to LAKEBASE_* for local development.
  const host = process.env.PGHOST ?? process.env.LAKEBASE_HOST;
  const database = process.env.PGDATABASE ?? process.env.LAKEBASE_DATABASE;
  const user = process.env.PGUSER ?? process.env.LAKEBASE_USER;
  const password = process.env.PGPASSWORD ?? process.env.LAKEBASE_PASSWORD;
  if (!host || !database || !user || !password) {
    throw new Error('Database env vars required: PGHOST/PGDATABASE/PGUSER/PGPASSWORD (or LAKEBASE_* for local dev)');
  }
  const ssl = (process.env.PGSSLMODE ?? process.env.LAKEBASE_SSL ?? 'require') as 'require' | 'allow' | 'prefer' | 'verify-full' | boolean;
  const client = postgres({
    host,
    database,
    user,
    password,
    port: Number(process.env.PGPORT ?? 5432),
    ssl,
    max: 10,
  });
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
