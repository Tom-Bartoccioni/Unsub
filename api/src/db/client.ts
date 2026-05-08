import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

let pool: pg.Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export function getDb(databaseUrl: string): NodePgDatabase<typeof schema> {
  if (db) return db;
  // Pool tuned for Neon's serverless idle behavior:
  // - Neon evicts idle compute after ~5 min and may drop pooled connections
  //   sooner. Closing our local idles after 10s avoids handing out a dead
  //   socket on the next request.
  // - Short connection timeout so a wedged dial-in fails fast and the auth
  //   plugin can retry on a fresh connection.
  pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });
  pool.on('error', (err) => {
    console.error('pg pool error (background client):', err);
  });
  db = drizzle(pool, { schema });
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export { schema };
