import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  firebaseUid: z.string().min(1),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;
