import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import { getDatabricksToken, isServicePrincipalAuthAvailable } from '@multi-genie/auth';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

// Resolves the Postgres password on every connection attempt. Lakebase OAuth tokens
// expire (~1 hour); postgres-js calls this function each time it opens a new connection
// from the pool, picking up a fresh token automatically. The getDatabricksToken() module
// caches and refreshes internally so this is cheap.
async function passwordProvider(): Promise<string> {
  const direct = process.env.PGPASSWORD ?? process.env.LAKEBASE_PASSWORD;
  if (direct) return direct;
  if (isServicePrincipalAuthAvailable()) {
    return getDatabricksToken();
  }
  throw new Error(
    'No PGPASSWORD/LAKEBASE_PASSWORD found and DATABRICKS_CLIENT_ID/SECRET not available for OAuth',
  );
}

export async function getDb() {
  if (_db) return _db;

  const host = process.env.PGHOST ?? process.env.LAKEBASE_HOST;
  const database = process.env.PGDATABASE ?? process.env.LAKEBASE_DATABASE;
  const user = process.env.PGUSER ?? process.env.LAKEBASE_USER;
  if (!host || !database || !user) {
    throw new Error(
      'Database env vars required: PGHOST/PGDATABASE/PGUSER (or LAKEBASE_* for local dev)',
    );
  }

  const port = Number(process.env.PGPORT ?? '5432');
  const sslmode = (process.env.PGSSLMODE ?? process.env.LAKEBASE_SSL ?? 'require') as
    | 'require'
    | 'prefer'
    | 'allow'
    | false;

  _client = postgres({
    host,
    database,
    user,
    // Pass the function (not a resolved value) so postgres-js calls it each
    // connection attempt — fresh OAuth token, no stale-token reconnect storms.
    password: passwordProvider,
    port,
    ssl: sslmode,
    max: 10,
    // Recycle idle connections more aggressively so we don't hold stale auth.
    idle_timeout: 60,
    max_lifetime: 60 * 30,
  });
  _db = drizzle(_client, { schema });

  console.log(`[DB] Configured pool for ${database} on ${host} (user: ${user})`);
  return _db;
}

export { schema };
