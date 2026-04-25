import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { googleAccounts, type GoogleAccountRow } from './schema.js';
import { decryptString, encryptString } from '../lib/crypto.js';

export type ConnectedGoogleAccount = Omit<GoogleAccountRow, 'encryptedRefreshToken'> & {
  refreshToken: string;
};

export type GoogleAccountStore = {
  upsertConnection: (input: {
    userId: string;
    googleEmail: string;
    refreshToken: string;
    scopes: string;
  }) => Promise<GoogleAccountRow>;
  findByUserId: (userId: string) => Promise<ConnectedGoogleAccount[]>;
  deleteByUserAndEmail: (userId: string, googleEmail: string) => Promise<void>;
};

export function createDrizzleGoogleAccountStore(
  db: NodePgDatabase<{ googleAccounts: typeof googleAccounts }>,
): GoogleAccountStore {
  return {
    async upsertConnection({ userId, googleEmail, refreshToken, scopes }) {
      const encrypted = encryptString(refreshToken);
      const [row] = await db
        .insert(googleAccounts)
        .values({ userId, googleEmail, encryptedRefreshToken: encrypted, scopes })
        .onConflictDoUpdate({
          target: [googleAccounts.userId, googleAccounts.googleEmail],
          set: {
            encryptedRefreshToken: encrypted,
            scopes,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) throw new Error('upsertConnection returned no row');
      return row;
    },
    async findByUserId(userId) {
      const rows = await db.select().from(googleAccounts).where(eq(googleAccounts.userId, userId));
      return rows.map(({ encryptedRefreshToken, ...rest }) => ({
        ...rest,
        refreshToken: decryptString(encryptedRefreshToken),
      }));
    },
    async deleteByUserAndEmail(userId, googleEmail) {
      await db
        .delete(googleAccounts)
        .where(and(eq(googleAccounts.userId, userId), eq(googleAccounts.googleEmail, googleEmail)));
    },
  };
}
