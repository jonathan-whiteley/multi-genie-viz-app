import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getDatabricksToken, isServicePrincipalAuthAvailable } from '@multi-genie/auth';

// PGHOST/PGDATABASE/PGUSER are auto-injected by the DAB 'database' resource binding.
// Fall back to LAKEBASE_* for local development. Password is resolved via OAuth if
// PGPASSWORD/LAKEBASE_PASSWORD is not set.
const host = process.env.PGHOST ?? process.env.LAKEBASE_HOST;
const database = process.env.PGDATABASE ?? process.env.LAKEBASE_DATABASE;
const user = process.env.PGUSER ?? process.env.LAKEBASE_USER;

if (!host || !database || !user) {
  console.error('Database env vars required: PGHOST/PGDATABASE/PGUSER (or LAKEBASE_* for local dev)');
  process.exit(1);
}

let password = process.env.PGPASSWORD ?? process.env.LAKEBASE_PASSWORD ?? '';
if (!password) {
  if (isServicePrincipalAuthAvailable()) {
    password = await getDatabricksToken();
  } else {
    console.error('No password resolved: set PGPASSWORD/LAKEBASE_PASSWORD or DATABRICKS_CLIENT_ID/SECRET/HOST');
    process.exit(1);
  }
}

const ssl = (process.env.PGSSLMODE ?? process.env.LAKEBASE_SSL ?? 'require') as 'require' | 'prefer' | 'allow' | false;

const client = postgres({
  host,
  database,
  user,
  password,
  port: Number(process.env.PGPORT ?? 5432),
  ssl,
  max: 1,
});
const db = drizzle(client);

console.log('Running migrations against', database, 'on', host);
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Done.');
await client.end();
