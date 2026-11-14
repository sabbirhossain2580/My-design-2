// src/db/users.ts
import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  const safeName = (name || email.split('@')[0] || 'Authorized User').trim();
  const safeEmail = (email || `${uid}@users.local`).trim();
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email: safeEmail,
        name: safeName,
        role: 'employee',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: safeEmail,
          name: safeName,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user registration query failed:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database user lookup query failed:', error);
    throw new Error('Failed to fetch user profile.', { cause: error });
  }
}
