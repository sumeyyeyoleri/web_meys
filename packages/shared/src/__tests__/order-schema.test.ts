import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { adminStatusChangeSchema, createOrderSchema, orderFormSchema } from '../schemas/order';

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

describe('order form', () => {
  it('accepts a complete order and normalises the email', () => {
    const result = createOrderSchema.parse(validOrder);
    expect(result.email).toBe('lotte@example.be');
    expect(result.serviceId).toBe(validOrder.serviceId);
  });

  it('keeps the service, email and extra address line optional', () => {
    const result = createOrderSchema.safeParse({ ...validOrder, serviceId: '', email: '', addressExtra: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serviceId).toBeUndefined();
      expect(result.data.email).toBeUndefined();
      expect(result.data.addressExtra).toBeUndefined();
    }
  });

  it('accepts form strings for the size (e.g. "30" and "1.5")', () => {
    const result = orderFormSchema.parse({ ...validOrder, width: '30', height: '1.5', unit: 'M' });
    expect(result).toMatchObject({ width: 30, height: 1.5, unit: 'M' });
  });

  it('reports every missing required field with an i18n key', () => {
    expect(fieldErrors(orderFormSchema.safeParse({}))).toEqual({
      width: 'validation.required',
      height: 'validation.required',
      unit: 'validation.invalidOption',
      description: 'validation.required',
      fullName: 'validation.required',
      phone: 'validation.required',
      country: 'validation.required',
      city: 'validation.required',
      postalCode: 'validation.required',
      street: 'validation.required',
      houseNumber: 'validation.required',
      privacyAccepted: 'validation.privacyRequired',
    });
  });

  it('validates the size, description, email and phone', () => {
    expect(
      fieldErrors(
        orderFormSchema.safeParse({ ...validOrder, width: -1, height: 0, description: 'too short', email: 'nope', phone: '0470' }),
      ),
    ).toEqual({
      width: 'validation.positive',
      height: 'validation.positive',
      description: 'validation.descriptionTooShort',
      email: 'validation.email',
      phone: 'validation.phone',
    });
  });

  it('rejects whitespace-only address fields', () => {
    expect(fieldErrors(orderFormSchema.safeParse({ ...validOrder, city: '   ', street: ' ', postalCode: '' }))).toEqual({
      city: 'validation.required',
      street: 'validation.required',
      postalCode: 'validation.required',
    });
  });

  it('requires the privacy checkbox', () => {
    expect(fieldErrors(orderFormSchema.safeParse({ ...validOrder, privacyAccepted: false }))).toEqual({
      privacyAccepted: 'validation.privacyRequired',
    });
  });

  it('requires an idempotency key and a supported communication language', () => {
    const { idempotencyKey: _key, ...withoutKey } = validOrder;
    expect(fieldErrors(createOrderSchema.safeParse({ ...withoutKey, communicationLocale: 'de' }))).toEqual({
      idempotencyKey: 'validation.invalid',
      communicationLocale: 'validation.invalidOption',
    });
  });

  it('accepts a catalog example and ignores an empty one', () => {
    const inspirationItemId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
    expect(createOrderSchema.parse({ ...validOrder, inspirationItemId }).inspirationItemId).toBe(inspirationItemId);
    expect(createOrderSchema.parse({ ...validOrder, inspirationItemId: '' }).inspirationItemId).toBeUndefined();
    expect(fieldErrors(createOrderSchema.safeParse({ ...validOrder, inspirationItemId: 'x' }))).toEqual({
      inspirationItemId: 'validation.invalid',
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
