import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants';
import { emailSchema, localeSchema, requiredString } from './common';

export const passwordSchema = z
  .string({ error: 'validation.required' })
  .min(1, 'validation.required')
  .min(PASSWORD_MIN_LENGTH, 'validation.passwordTooShort')
  .max(PASSWORD_MAX_LENGTH, 'validation.passwordTooLong');

/** Adds a "passwords do not match" issue on `confirmField`. */
export function refinePasswordConfirmation<T extends Record<string, unknown>>(
  passwordField: keyof T & string,
  confirmField: keyof T & string,
) {
  return (value: T, ctx: z.RefinementCtx) => {
    if (value[passwordField] !== value[confirmField]) {
      ctx.addIssue({ code: 'custom', path: [confirmField], message: 'validation.passwordsDontMatch' });
    }
  };
}

export const registerSchema = z
  .object({
    fullName: requiredString(120),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string({ error: 'validation.required' }).min(1, 'validation.required'),
    preferredLocale: localeSchema,
  })
  .superRefine(refinePasswordConfirmation('password', 'passwordConfirm'));
export type RegisterInput = z.infer<typeof registerSchema>;

/** Login deliberately does not apply the password policy, so it never hints at account details. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'validation.required' }).min(1, 'validation.required').max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string({ error: 'validation.required' }).min(1, 'validation.required').max(200),
    password: passwordSchema,
    passwordConfirm: z.string({ error: 'validation.required' }).min(1, 'validation.required'),
  })
  .superRefine(refinePasswordConfirmation('password', 'passwordConfirm'));
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'validation.required' }).min(1, 'validation.required').max(PASSWORD_MAX_LENGTH),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string({ error: 'validation.required' }).min(1, 'validation.required'),
  })
  .superRefine(refinePasswordConfirmation('newPassword', 'newPasswordConfirm'));
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
