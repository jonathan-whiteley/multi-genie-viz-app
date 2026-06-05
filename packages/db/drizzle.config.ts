import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.LAKEBASE_HOST!,
    database: process.env.LAKEBASE_DATABASE!,
    user: process.env.LAKEBASE_USER!,
    password: process.env.LAKEBASE_PASSWORD!,
    port: 5432,
    ssl: 'require',
  },
});
