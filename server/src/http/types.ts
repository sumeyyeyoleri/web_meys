import type { UserWithProfile } from '../repositories/user.repository';

export interface RequestAuth {
  user: UserWithProfile;
  sessionToken: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: RequestAuth;
    }
  }
}
