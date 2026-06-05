import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const host = process.env.LAKEBASE_HOST;
const database = process.env.LAKEBASE_DATABASE;
const user = process.env.LAKEBASE_USER;
const password = process.env.LAKEBASE_PASSWORD;

if (!host || !database || !user || !password) {
  console.error('LAKEBASE_HOST, LAKEBASE_DATABASE, LAKEBASE_USER, LAKEBASE_PASSWORD required');
  process.exit(1);
}

const client = postgres({
  host,
  database,
  user,
  password,
  port: 5432,
  ssl: (process.env.LAKEBASE_SSL ?? 'require') as 'require' | 'prefer' | 'allow' | false,
  max: 1,
});
const db = drizzle(client);

console.log('Running migrations against', database, 'on', host);
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Done.');
await client.end();
