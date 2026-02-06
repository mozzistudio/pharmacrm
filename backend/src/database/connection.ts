import knex, { Knex } from 'knex';
import { config } from '../config';
import { logger } from '../utils/logger';
import knexConfig from './knexfile';

let db: Knex;

export function getDatabase(): Knex {
  if (!db) {
    const env = config.env === 'production' ? 'production' : 'development';
    db = knex(knexConfig[env]);
    logger.info(`Database connection initialized (${env})`);
  }
  return db;
}

export async function testConnection(): Promise<boolean> {
  try {
    const database = getDatabase();
    await database.raw('SELECT 1');
    logger.info('Database connection verified');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error });
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    logger.info('Database connection closed');
  }
}
