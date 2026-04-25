import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDb, getDb } from './client.js';
import { loadEnv } from '../env.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);
  console.log('Running migrations…');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('Migrations applied.');
  await closeDb();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
