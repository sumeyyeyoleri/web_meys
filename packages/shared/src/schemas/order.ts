import { z } from 'zod';
import { DIMENSION_UNITS, MESSAGE_MAX_LENGTH, ORDER_DESCRIPTION_MIN_LENGTH } from '../constants';
import { ORDER_STATUSES } from '../order-status';
import {
  emptyToUndefined,
  isoDateSchema,
  localeSchema,
  optionalEmailSchema,
  optionalPositiveNumber,
  optionalString,
  paginationQuerySchema,
  phoneSchema,
  queryBooleanSchema,
  requiredPositiveNumber,
  requiredString,
  uuidSchema,
} from './common';

const optionalUuid = z.preprocess(emptyToUndefined, uuidSchema.optional());
const optionalDate = z.preprocess(emptyToUndefined, isoDateSchema.optional());

/* ---------- Order form (the `data` part of POST /api/orders) ---------- */

/** Fields of the single-page order form, in the order they appear (used to focus the first error). */
export const orderFormShape = {
  categoryId: optionalUuid,
  width: requiredPositiveNumber(100_000),
  height: requiredPositiveNumber(100_000),
  unit: z.enum(DIMENSION_UNITS, { error: 'validation.invalidOption' }),
  description: z
    .string({ error: 'validation.required' })
    .trim()
    .min(1, 'validation.required')
    .min(ORDER_DESCRIPTION_MIN_LENGTH, 'validation.descriptionTooShort')
    .max(5000, 'validation.tooLong'),
  fullName: requiredString(120),
  phone: phoneSchema,
  /** Optional: when given, the tracking link and updates are also emailed (if SMTP is configured). */
  email: optionalEmailSchema,
  country: requiredString(100),
  city: requiredString(100),
  postalCode: requiredString(20),
  street: requiredString(150),
  houseNumber: requiredString(20),
  addressExtra: optionalString(150),
  privacyAccepted: z.literal(true, { error: 'validation.privacyRequired' }),
};
export const ORDER_FORM_FIELDS = Object.keys(orderFormShape) as Array<keyof typeof orderFormShape>;

export const orderFormSchema = z.object(orderFormShape);
export type OrderFormInput = z.input<typeof orderFormSchema>;

export const createOrderSchema = z.object({
  ...orderFormShape,
  idempotencyKey: uuidSchema,
  /** Catalog item the order starts from ("Request something similar"). */
  inspirationItemId: optionalUuid,
  /** The site language at the moment of submitting; not asked in the form. */
  communicationLocale: localeSchema,
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

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

/** Admin correction of the submitted order data. Fields of older orders (budget, deadline …) stay as submitted. */
export const adminOrderUpdateSchema = z.object({
  categoryId: optionalUuid,
  title: requiredString(150),
  width: orderFormShape.width,
  height: orderFormShape.height,
  unit: orderFormShape.unit,
  description: orderFormShape.description,
  fullName: orderFormShape.fullName,
  email: orderFormShape.email,
  phone: orderFormShape.phone,
  country: orderFormShape.country,
  city: orderFormShape.city,
  postalCode: orderFormShape.postalCode,
  street: orderFormShape.street,
  houseNumber: orderFormShape.houseNumber,
  addressExtra: orderFormShape.addressExtra,
  communicationLocale: localeSchema,
});
export type AdminOrderUpdateInput = z.infer<typeof adminOrderUpdateSchema>;

export const messageBodySchema = z.object({
  body: requiredString(MESSAGE_MAX_LENGTH),
});
export type MessageBodyInput = z.infer<typeof messageBodySchema>;

/** "Translate" on a message: into the viewer's current language. */
export const translateMessageSchema = z.object({
  targetLocale: localeSchema,
});
export type TranslateMessageInput = z.infer<typeof translateMessageSchema>;

/* ---------- Queries ---------- */

export const adminOrderListQuerySchema = paginationQuerySchema.extend({
  status: z.preprocess(emptyToUndefined, z.enum(ORDER_STATUSES, { error: 'validation.invalidOption' }).optional()),
  from: optionalDate,
  to: optionalDate,
  q: optionalString(200),
  includeArchived: z.preprocess(emptyToUndefined, queryBooleanSchema.optional()),
});
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
