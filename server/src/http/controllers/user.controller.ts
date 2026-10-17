import type { Request, Response } from 'express';
import { updateProfileSchema } from '@painter/shared';
import type { Services } from '../../container';
import { toUserDto } from '../mappers/user.mapper';
import { getAuth } from '../middleware/auth';
import { parseBody } from '../middleware/validation';

export function createUserController({ users }: Services) {
  return {
    async updateMe(req: Request, res: Response) {
      const { user } = getAuth(req);
      const updated = await users.updateProfile(user.id, parseBody(updateProfileSchema, req));
      res.json(toUserDto(updated));
    },
  };
}
