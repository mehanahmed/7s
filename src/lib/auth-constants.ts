
import type { User } from '@/types';
// getUserByEmail will now be used from user-service.ts for login
// MOCK_USERS is now empty. Login fully relies on Firestore.
// The seedInitialAdminUser function in user-service.ts (called by AuthContext)
// handles the creation of the initial admin user in Firestore.

export const MOCK_USERS: User[] = [];

// findUserByEmailAndPasswordInMock is no longer needed as login uses Firestore.
