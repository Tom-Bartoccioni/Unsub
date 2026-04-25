import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, type UserRow } from './schema.js';

export type UserStore = {
  upsertByFirebaseUid: (input: { firebaseUid: string; email: string }) => Promise<UserRow>;
  findByFirebaseUid: (firebaseUid: string) => Promise<UserRow | null>;
};

export function createDrizzleUserStore(db: NodePgDatabase<{ users: typeof users }>): UserStore {
  return {
    async upsertByFirebaseUid({ firebaseUid, email }) {
      const [row] = await db
        .insert(users)
        .values({ firebaseUid, email })
        .onConflictDoUpdate({
          target: users.firebaseUid,
          set: { email },
        })
        .returning();
      if (!row) throw new Error('upsert returned no row');
      return row;
    },
    async findByFirebaseUid(firebaseUid) {
      const rows = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
      return rows[0] ?? null;
    },
  };
}
