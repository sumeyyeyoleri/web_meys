import type { UserWithProfile } from '../repositories/user.repository';

export interface RequestAuth {
  user: UserWithProfile;
  sessionToken: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: RequestAuth;
      /** Set by `requireTrackingToken`: the one guest order the request's tracking token opens. */
      trackedOrderId?: string;
    }
  }
}
