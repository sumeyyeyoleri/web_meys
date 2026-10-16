import { z } from 'zod';
import { DIMENSION_UNITS, MESSAGE_MAX_LENGTH, ORDER_DESCRIPTION_MIN_LENGTH } from '../constants';
import { ORDER_STATUSES } from '../order-status';
import { passwordSchema, refinePasswordConfirmation } from './auth';
import {
  emailSchema,
  emptyToUndefined,
  isoDateSchema,
  localeSchema,
  optionalPositiveNumber,
  optionalString,
  paginationQuerySchema,
  phoneSchema,
  queryBooleanSchema,
  requiredPositiveNumber,
  requiredString,
  todayIsoDate,
  uuidSchema,
} from './common';

/** Settings that change which order fields are required (admin-controlled). */
export interface OrderRequirementOptions {
  budgetRequired: boolean;
  deadlineRequired: boolean;
  /** `YYYY-MM-DD`; deadlines before this day are rejected. Defaults to today. */
  today?: string;
}

const optionalUuid = z.preprocess(emptyToUndefined, uuidSchema.optional());
const optionalDate = z.preprocess(emptyToUndefined, isoDateSchema.optional());

/* ---------- Step 1: service ---------- */

export const serviceStepShape = {
  serviceId: optionalUuid,
  customRequest: optionalString(2000),
};

function refineServiceStep(value: { serviceId?: string; customRequest?: string }, ctx: z.RefinementCtx) {
  if (!value.serviceId && !value.customRequest) {
    ctx.addIssue({ code: 'custom', path: ['serviceId'], message: 'validation.serviceOrCustomRequired' });
  }
}

export const serviceStepSchema = z.object(serviceStepShape).superRefine(refineServiceStep);
export type ServiceStepInput = z.input<typeof serviceStepSchema>;

/* ---------- Step 2: dimensions ---------- */

export const dimensionsStepShape = {
  width: requiredPositiveNumber(100_000),
  height: requiredPositiveNumber(100_000),
  unit: z.enum(DIMENSION_UNITS, { error: 'validation.invalidOption' }),
  wallWidth: optionalPositiveNumber(100_000),
  wallHeight: optionalPositiveNumber(100_000),
  surfaceDetails: optionalString(2000),
  extraSpecifications: optionalString(2000),
};

export const dimensionsStepSchema = z.object(dimensionsStepShape);
export type DimensionsStepInput = z.input<typeof dimensionsStepSchema>;

/* ---------- Step 4: details ---------- */

export const detailsStepShape = {
  title: requiredString(150),
  description: z
    .string({ error: 'validation.required' })
    .trim()
    .min(1, 'validation.required')
    .min(ORDER_DESCRIPTION_MIN_LENGTH, 'validation.descriptionTooShort')
    .max(5000, 'validation.tooLong'),
  stylePreferences: optionalString(1000),
  colorPreferences: optionalString(1000),
  themePreferences: optionalString(1000),
  budgetMin: optionalPositiveNumber(10_000_000),
  budgetMax: optionalPositiveNumber(10_000_000),
  deadline: optionalDate,
  extraInstructions: optionalString(2000),
};

interface DetailsValues {
  budgetMin?: number;
  budgetMax?: number;
  deadline?: string;
}

function refineBudgetRange(value: DetailsValues, ctx: z.RefinementCtx) {
  if (value.budgetMin !== undefined && value.budgetMax !== undefined && value.budgetMax < value.budgetMin) {
    ctx.addIssue({ code: 'custom', path: ['budgetMax'], message: 'validation.budgetRange' });
  }
}

function refineDetailsStep(options: OrderRequirementOptions) {
  const today = options.today ?? todayIsoDate();
  return (value: DetailsValues, ctx: z.RefinementCtx) => {
    if (options.budgetRequired) {
      if (value.budgetMin === undefined) {
        ctx.addIssue({ code: 'custom', path: ['budgetMin'], message: 'validation.required' });
      }
      if (value.budgetMax === undefined) {
        ctx.addIssue({ code: 'custom', path: ['budgetMax'], message: 'validation.required' });
      }
    }
    refineBudgetRange(value, ctx);
    if (value.deadline === undefined) {
      if (options.deadlineRequired) {
        ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'validation.required' });
      }
    } else if (value.deadline < today) {
      // ISO dates compare correctly as strings.
      ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'validation.deadlinePast' });
    }
  };
}

export function buildDetailsStepSchema(options: OrderRequirementOptions) {
  return z.object(detailsStepShape).superRefine(refineDetailsStep(options));
}
export type DetailsStepInput = z.input<ReturnType<typeof buildDetailsStepSchema>>;

/* ---------- Step 5: contact & project address ---------- */

export const contactStepShape = {
  fullName: requiredString(120),
  email: emailSchema,
  phone: phoneSchema,
  country: requiredString(100),
  city: requiredString(100),
  postalCode: requiredString(20),
  street: requiredString(150),
  houseNumber: requiredString(20),
  addressExtra: optionalString(150),
  communicationLocale: localeSchema,
};

export const contactStepSchema = z.object(contactStepShape);

/** Extra fields for guests: an account is created together with the order. */
export const accountStepShape = {
  password: passwordSchema,
  passwordConfirm: z.string({ error: 'validation.required' }).min(1, 'validation.required'),
};

export function buildContactStepSchema(isGuest: boolean) {
  if (!isGuest) return contactStepSchema;
  return z
    .object({ ...contactStepShape, ...accountStepShape })
    .superRefine(refinePasswordConfirmation('password', 'passwordConfirm'));
}
export type ContactStepInput = z.input<typeof contactStepSchema> & {
  password?: string;
  passwordConfirm?: string;
};

/* ---------- Step 6: review ---------- */

export const reviewStepShape = {
  privacyAccepted: z.literal(true, { error: 'validation.privacyRequired' }),
};
export const reviewStepSchema = z.object(reviewStepShape);

/* ---------- Full submission (the `data` part of POST /api/orders) ---------- */

export interface CreateOrderSchemaOptions extends OrderRequirementOptions {
  isGuest: boolean;
}

export function buildCreateOrderSchema(options: CreateOrderSchemaOptions) {
  const refineDetails = refineDetailsStep(options);
  const refinePasswords = refinePasswordConfirmation('password', 'passwordConfirm');
  const shape = {
    idempotencyKey: uuidSchema,
    ...serviceStepShape,
    ...dimensionsStepShape,
    ...detailsStepShape,
    ...contactStepShape,
    ...reviewStepShape,
  };
  if (options.isGuest) {
    return z.object({ ...shape, ...accountStepShape }).superRefine((value, ctx) => {
      refineServiceStep(value, ctx);
      refineDetails(value, ctx);
      refinePasswords(value, ctx);
    });
  }
  return z.object(shape).superRefine((value, ctx) => {
    refineServiceStep(value, ctx);
    refineDetails(value, ctx);
  });
}
export type CreateOrderInput = z.infer<ReturnType<typeof buildCreateOrderSchema>> & {
  password?: string;
  passwordConfirm?: string;
};

/* ---------- Order actions ---------- */

export const CUSTOMER_STATUS_ACTIONS = ['ACCEPTED', 'CANCELLED'] as const;

export const customerStatusActionSchema = z.object({
  status: z.enum(CUSTOMER_STATUS_ACTIONS, { error: 'validation.invalidOption' }),
});
export type CustomerStatusActionInput = z.infer<typeof customerStatusActionSchema>;

export const adminStatusChangeSchema = z
  .object({
    status: z.enum(ORDER_STATUSES, { error: 'validation.invalidOption' }),
    quoteAmount: optionalPositiveNumber(10_000_000),
    note: optionalString(2000),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'QUOTE_SENT' && value.quoteAmount === undefined) {
      ctx.addIssue({ code: 'custom', path: ['quoteAmount'], message: 'validation.quoteRequired' });
    }
  });
export type AdminStatusChangeInput = z.infer<typeof adminStatusChangeSchema>;

/** Admin edit of the submitted order data. Past deadlines are allowed here (historic orders). */
export const adminOrderUpdateSchema = z
  .object({
    ...serviceStepShape,
    ...dimensionsStepShape,
    ...detailsStepShape,
    ...contactStepShape,
  })
  .superRefine((value, ctx) => {
    refineServiceStep(value, ctx);
    refineBudgetRange(value, ctx);
  });
export type AdminOrderUpdateInput = z.infer<typeof adminOrderUpdateSchema>;

export const messageBodySchema = z.object({
  body: requiredString(MESSAGE_MAX_LENGTH),
});
export type MessageBodyInput = z.infer<typeof messageBodySchema>;

/* ---------- Queries ---------- */

export const customerOrderListQuerySchema = paginationQuerySchema;

export const adminOrderListQuerySchema = paginationQuerySchema.extend({
  status: z.preprocess(emptyToUndefined, z.enum(ORDER_STATUSES, { error: 'validation.invalidOption' }).optional()),
  from: optionalDate,
  to: optionalDate,
  q: optionalString(200),
  includeArchived: z.preprocess(emptyToUndefined, queryBooleanSchema.optional()),
});
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
