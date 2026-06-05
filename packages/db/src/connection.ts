import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const host = process.env.LAKEBASE_HOST;
  const database = process.env.LAKEBASE_DATABASE;
  const user = process.env.LAKEBASE_USER;
  const password = process.env.LAKEBASE_PASSWORD;
  if (!host || !database || !user || !password) {
    throw new Error('LAKEBASE_HOST, LAKEBASE_DATABASE, LAKEBASE_USER, LAKEBASE_PASSWORD required');
  }
  const client = postgres({
    host,
    database,
    user,
    password,
    port: 5432,
    ssl: (process.env.LAKEBASE_SSL ?? 'require') as 'require' | 'allow' | 'prefer' | 'verify-full' | boolean,
    max: 10,
  });
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
