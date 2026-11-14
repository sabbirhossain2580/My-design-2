// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME);
}

// Function to create or retrieve the connection pool using the Object Method
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 15000,
      allowExitOnIdle: true,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Prevent unhandled pool-level errors from crashing or spamming stderr on Cloud SQL scale-to-zero idle disconnects
    global._postgresPool.on('error', (err: NodeJS.ErrnoException & { code?: string }) => {
      const msg = err?.message || '';
      const isTransientIdleDisconnect =
        msg.includes('Connection terminated unexpectedly') ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'EPIPE' ||
        err?.code === '57P01';

      if (isTransientIdleDisconnect) {
        console.warn('Idle SQL pool client recycled after remote disconnect.');
        return;
      }
      console.error('SQL pool error:', msg || 'Unknown pool error');
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance
export const pool = createPool();

// Initialize Drizzle with the pool and schema
export const db = drizzle(pool, { schema });

// Bounded exponential backoff helper for Cloud SQL cold-start wake-up / transient socket resets
export async function withDbRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  const attempts = Math.min(Math.max(maxRetries, 1), 3);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const code = String(err?.code || '');
      const isTransient =
        msg.includes('Connection terminated unexpectedly') ||
        msg.includes('timeout exceeded when trying to connect') ||
        code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        code === 'ETIMEDOUT' ||
        code === 'EPIPE' ||
        code === '57P01' ||
        code === '57P03';

      // Never retry auth (28P01) or SQL schema/syntax errors (42xxx)
      if (!isTransient || attempt === attempts) {
        throw err;
      }

      const backoffMs = 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}
