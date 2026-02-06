import knex from 'knex';
import { up } from './src/database/migrations/001_initial_schema';

const db = knex({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'pharmacrm',
    user: 'pharmacrm_user',
    password: 'dev_password_change_me',
  },
});

async function run() {
  try {
    await db.raw('SELECT 1');
    console.log('DB connected');
    await up(db);
    console.log('Migration completed successfully');
  } catch (e: unknown) {
    console.error('Migration error:', (e as Error).message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

run();
