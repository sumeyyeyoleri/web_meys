import type { AdminUser } from '../repositories/user.repository';

export interface RequestAuth {
  user: AdminUser;
  sessionToken: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: RequestAuth;
      /** Set by `requireTrackingToken`: the one order the request's tracking token opens. */
      trackedOrderId?: string;
    }
  }
}
