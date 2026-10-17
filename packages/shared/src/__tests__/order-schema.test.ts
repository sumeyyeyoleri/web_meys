import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  adminStatusChangeSchema,
  buildCreateOrderSchema,
  buildDetailsStepSchema,
  dimensionsStepSchema,
  serviceStepSchema,
} from '../schemas/order';

const TODAY = '2026-06-15';

function fieldErrors(result: z.ZodSafeParseResult<unknown>): Record<string, string> {
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    out[key] ??= issue.message;
  }
  return out;
}

const validOrder = {
  idempotencyKey: '3f1c2b8e-4d5a-4c6b-9e7f-1a2b3c4d5e6f',
  serviceId: '5b8f8c1e-2f3a-4b5c-8d7e-9f0a1b2c3d4e',
  width: 120,
  height: 80,
  unit: 'CM',
  title: 'Mural for the living room',
  description: 'A calm, abstract landscape in warm earth tones for the main wall.',
  fullName: 'Lotte Peeters',
  email: 'Lotte@Example.be ',
  phone: '+32 470 12 34 56',
  country: 'België',
  city: 'Gent',
  postalCode: '9000',
  street: 'Veldstraat',
  houseNumber: '12',
  communicationLocale: 'nl-BE',
  privacyAccepted: true,
};

const relaxed = { budgetRequired: false, deadlineRequired: false, today: TODAY };

describe('service step', () => {
  it('requires a service or a custom request', () => {
    expect(fieldErrors(serviceStepSchema.safeParse({}))).toEqual({
      serviceId: 'validation.serviceOrCustomRequired',
    });
    expect(serviceStepSchema.safeParse({ customRequest: 'A portrait of my dog' }).success).toBe(true);
    expect(serviceStepSchema.safeParse({ serviceId: validOrder.serviceId, customRequest: '' }).success).toBe(true);
  });
});

describe('dimensions step', () => {
  it('requires positive width and height and accepts form strings', () => {
    expect(fieldErrors(dimensionsStepSchema.safeParse({ width: '', height: NaN, unit: 'CM' }))).toEqual({
      width: 'validation.required',
      height: 'validation.required',
    });
    expect(fieldErrors(dimensionsStepSchema.safeParse({ width: -1, height: 'abc', unit: 'CM' }))).toEqual({
      width: 'validation.positive',
      height: 'validation.number',
    });
    const parsed = dimensionsStepSchema.parse({ width: '2,5', height: '3', unit: 'M', wallWidth: '' });
    expect(parsed).toMatchObject({ width: 2.5, height: 3, unit: 'M', wallWidth: undefined });
  });
});

describe('details step', () => {
  const base = { title: 'Portrait', description: 'A detailed oil portrait of my grandmother.' };

  it('requires title and a description of at least 20 characters', () => {
    const errors = fieldErrors(buildDetailsStepSchema(relaxed).safeParse({ title: ' ', description: 'too short' }));
    expect(errors).toEqual({ title: 'validation.required', description: 'validation.descriptionTooShort' });
  });

  it('keeps budget and deadline optional by default', () => {
    expect(buildDetailsStepSchema(relaxed).safeParse(base).success).toBe(true);
  });

  it('rejects a budget maximum below the minimum', () => {
    const result = buildDetailsStepSchema(relaxed).safeParse({ ...base, budgetMin: 500, budgetMax: 200 });
    expect(fieldErrors(result)).toEqual({ budgetMax: 'validation.budgetRange' });
    expect(buildDetailsStepSchema(relaxed).safeParse({ ...base, budgetMin: 200, budgetMax: 200 }).success).toBe(true);
  });

  it('rejects a deadline in the past but accepts today', () => {
    const schema = buildDetailsStepSchema(relaxed);
    expect(fieldErrors(schema.safeParse({ ...base, deadline: '2026-06-14' }))).toEqual({
      deadline: 'validation.deadlinePast',
    });
    expect(schema.safeParse({ ...base, deadline: TODAY }).success).toBe(true);
    expect(fieldErrors(schema.safeParse({ ...base, deadline: '15/06/2026' }))).toEqual({ deadline: 'validation.date' });
  });

  it('enforces budget and deadline when the admin requires them', () => {
    const schema = buildDetailsStepSchema({ budgetRequired: true, deadlineRequired: true, today: TODAY });
    expect(fieldErrors(schema.safeParse(base))).toEqual({
      budgetMin: 'validation.required',
      budgetMax: 'validation.required',
      deadline: 'validation.required',
    });
    expect(schema.safeParse({ ...base, budgetMin: 100, budgetMax: 300, deadline: '2026-09-01' }).success).toBe(true);
  });
});

describe('full order submission', () => {
  it('accepts a valid order for a logged-in customer and normalises the email', () => {
    const parsed = buildCreateOrderSchema({ ...relaxed, isGuest: false }).parse(validOrder);
    expect(parsed.email).toBe('lotte@example.be');
  });

  it('reports every missing required field', () => {
    const errors = fieldErrors(buildCreateOrderSchema({ ...relaxed, isGuest: false }).safeParse({}));
    for (const field of [
      'idempotencyKey',
      'width',
      'height',
      'unit',
      'title',
      'description',
      'fullName',
      'email',
      'phone',
      'country',
      'city',
      'postalCode',
      'street',
      'houseNumber',
      'communicationLocale',
      'privacyAccepted',
    ]) {
      expect(errors[field], field).toBeDefined();
    }
  });

  it('requires accepting the privacy notice', () => {
    const result = buildCreateOrderSchema({ ...relaxed, isGuest: false }).safeParse({
      ...validOrder,
      privacyAccepted: false,
    });
    expect(fieldErrors(result)).toEqual({ privacyAccepted: 'validation.privacyRequired' });
  });

  it('validates the phone number format', () => {
    const result = buildCreateOrderSchema({ ...relaxed, isGuest: false }).safeParse({ ...validOrder, phone: '0470123456' });
    expect(fieldErrors(result)).toEqual({ phone: 'validation.phone' });
  });

  it('requires a matching password of at least 10 characters for guests', () => {
    const schema = buildCreateOrderSchema({ ...relaxed, isGuest: true });
    expect(fieldErrors(schema.safeParse(validOrder))).toMatchObject({ password: 'validation.required' });
    expect(fieldErrors(schema.safeParse({ ...validOrder, password: 'short', passwordConfirm: 'short' }))).toEqual({
      password: 'validation.passwordTooShort',
    });
    expect(
      fieldErrors(schema.safeParse({ ...validOrder, password: 'long-enough-1', passwordConfirm: 'long-enough-2' })),
    ).toEqual({ passwordConfirm: 'validation.passwordsDontMatch' });
    expect(schema.safeParse({ ...validOrder, password: 'long-enough-1', passwordConfirm: 'long-enough-1' }).success).toBe(
      true,
    );
  });

  it('applies the admin requirement toggles to the full submission', () => {
    const schema = buildCreateOrderSchema({ budgetRequired: true, deadlineRequired: true, today: TODAY, isGuest: false });
    expect(fieldErrors(schema.safeParse(validOrder))).toEqual({
      budgetMin: 'validation.required',
      budgetMax: 'validation.required',
      deadline: 'validation.required',
    });
  });
});

describe('admin status change', () => {
  it('requires a quote amount when sending a quote', () => {
    expect(fieldErrors(adminStatusChangeSchema.safeParse({ status: 'QUOTE_SENT' }))).toEqual({
      quoteAmount: 'validation.quoteRequired',
    });
    expect(adminStatusChangeSchema.safeParse({ status: 'QUOTE_SENT', quoteAmount: 850 }).success).toBe(true);
    expect(adminStatusChangeSchema.safeParse({ status: 'UNDER_REVIEW' }).success).toBe(true);
  });
});

describe('inspiration (Request something similar)', () => {
  const inspirationItemId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

  it('lets a catalog example alone satisfy the service step', () => {
    expect(serviceStepSchema.safeParse({ inspirationItemId }).success).toBe(true);
    const { serviceId: _omit, ...withoutService } = validOrder;
    const schema = buildCreateOrderSchema({ ...relaxed, isGuest: false });
    expect(schema.safeParse({ ...withoutService, inspirationItemId }).success).toBe(true);
    expect(fieldErrors(schema.safeParse(withoutService))).toEqual({ serviceId: 'validation.serviceOrCustomRequired' });
  });

  it('rejects a malformed inspiration id and ignores an empty one', () => {
    expect(fieldErrors(serviceStepSchema.safeParse({ serviceId: validOrder.serviceId, inspirationItemId: 'x' }))).toEqual({
      inspirationItemId: 'validation.invalid',
    });
    expect(serviceStepSchema.parse({ serviceId: validOrder.serviceId, inspirationItemId: '' }).inspirationItemId).toBeUndefined();
  });
});
