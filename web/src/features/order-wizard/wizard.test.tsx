import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderDetailDto } from '@painter/shared';
import { setLocale } from '../../lib/i18n';
import { customer, json, mockApi, portfolio, uid } from '../../test/fixtures';
import { renderApp } from '../../test/render';

beforeEach(() => setLocale('nl-BE'));
afterEach(() => vi.unstubAllGlobals());

const user = userEvent.setup();
const next = () => user.click(screen.getByRole('button', { name: /Volgende stap/ }));
const field = (name: RegExp | string) => screen.getByLabelText(name, { selector: 'input,textarea,select' });

function orderResult(data: Record<string, unknown>): OrderDetailDto {
  return {
    id: 'o1',
    reference: 'ORD-2026-7K3QXM',
    title: String(data.title),
    status: 'SUBMITTED',
    serviceName: 'Muurschildering',
    quoteAmount: null,
    unreadMessages: 0,
    createdAt: '2026-10-17T10:00:00.000Z',
    updatedAt: '2026-10-17T10:00:00.000Z',
    inspiration: data.inspirationItemId ? { id: uid('a2'), title: 'Maanlichtheuvels', imageUrl: '/media/portfolio/maanlichtheuvels.svg' } : null,
    additionalSpecs: (data.additionalSpecs as string) ?? null,
  } as OrderDetailDto;
}

async function fillUntilContact() {
  // Step 2 — dimensions
  await user.type(field('Breedte'), '3,5');
  await user.type(field('Hoogte'), '2');
  await user.selectOptions(field('Eenheid'), 'M');
  await next();
  // Step 3 — references
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'muur.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText('Afbeeldingen kiezen', { selector: 'input', exact: false }) as HTMLInputElement, file);
  expect(await screen.findByText('1 van 8 afbeeldingen')).toBeTruthy();
  await next();
  // Step 4 — details
  await user.type(field('Titel van uw project'), 'Kinderkamer');
  await user.type(field('Beschrijving'), 'Een rustige nachthemel met heuvels voor de kinderkamer.');
  await next();
}

describe('order wizard', () => {
  it('starts from a catalog item, attaches it and preselects the matching service', async () => {
    mockApi();
    renderApp(`/order?from=${uid('a2')}`);
    expect(await screen.findByText(/U vertrekt van ‘Maanlichtheuvels’/)).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Muurschildering/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Stap 1 / 6')).toBeTruthy();
    expect(field(/Wat wilt u anders dan in het voorbeeld\?/)).toBeTruthy();
  });

  it('validates each step with the shared schemas before moving on', async () => {
    mockApi();
    renderApp('/order');
    await screen.findByRole('heading', { level: 2, name: 'Wat wilt u laten maken?' });
    await next();
    expect(await screen.findByText('Kies een dienst of beschrijf uw eigen aanvraag.')).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: /Schilderij op maat/ }));
    await next();
    await screen.findByRole('heading', { level: 2, name: 'Hoe groot moet het worden?' });
    await next();
    expect((await screen.findAllByText('Dit veld is verplicht.')).length).toBe(2);
    await user.type(field('Breedte'), '-1');
    await user.type(field('Hoogte'), '40');
    await next();
    expect(await screen.findByText('Vul een getal groter dan 0 in.')).toBeTruthy();
  });

  it('keeps entered data when going back, then submits a guest order as one multipart request', async () => {
    let sent: FormData | undefined;
    mockApi({
      routes: {
        'POST /api/orders': (init) => {
          sent = init?.body as FormData;
          const data = JSON.parse(String(sent.get('data'))) as Record<string, unknown>;
          return json(201, { order: orderResult(data), created: true, user: { ...customer, email: String(data.email) } });
        },
        'GET /api/orders/o1': () => json(200, orderResult({ title: 'Kinderkamer', inspirationItemId: uid('a2') })),
      },
    });
    const { router } = renderApp(`/order?from=${uid('a2')}`);
    await screen.findByText(/U vertrekt van ‘Maanlichtheuvels’/);
    await user.type(field(/Wat wilt u anders dan in het voorbeeld\?/), 'Met een vos');
    await next();

    await user.type(field('Breedte'), '9');
    await user.click(screen.getByRole('button', { name: /Vorige stap/ }));
    expect((field(/Wat wilt u anders dan in het voorbeeld\?/) as HTMLTextAreaElement).value).toBe('Met een vos');
    await next();
    expect((field('Breedte') as HTMLInputElement).value).toBe('9');
    await user.clear(field('Breedte'));

    await fillUntilContact();
    // Step 5 — contact (guest: also chooses a password)
    await user.type(field('Volledige naam'), 'Lotte Peeters');
    await user.type(field('E-mailadres'), 'lotte@example.be');
    await user.type(field(/Gsm-nummer/), '+32 470 12 34 56');
    await user.type(field('Straat'), 'Veldstraat');
    await user.type(field('Huisnummer'), '12');
    await user.type(field('Gemeente'), 'Gent');
    await user.type(field('Postcode'), '9000');
    await user.type(field('Land'), 'België');
    await user.type(field('Kies een wachtwoord'), 'lang-genoeg-1');
    await user.type(field('Herhaal het wachtwoord'), 'lang-genoeg-1');
    await next();

    // Step 6 — review: privacy is required
    await screen.findByRole('heading', { level: 2, name: 'Nakijken en versturen' });
    expect(screen.getAllByText('3,5 × 2 m').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Aanvraag versturen' }));
    expect(await screen.findByText('U moet de privacyverklaring aanvaarden om verder te gaan.')).toBeTruthy();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Aanvraag versturen' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/order/confirmation/o1'));
    const data = JSON.parse(String(sent!.get('data'))) as Record<string, unknown>;
    expect(data).toMatchObject({
      inspirationItemId: uid('a2'),
      additionalSpecs: 'Met een vos',
      width: 3.5,
      height: 2,
      unit: 'M',
      email: 'lotte@example.be',
      password: 'lang-genoeg-1',
      privacyAccepted: true,
    });
    expect(String(data.idempotencyKey)).toMatch(/^[0-9a-f-]{36}$/);
    expect((sent!.getAll('files')[0] as File).name).toBe('muur.png');
    expect(await screen.findByText('ORD-2026-7K3QXM')).toBeTruthy();
    expect(screen.getByText('Geïnspireerd op: Maanlichtheuvels')).toBeTruthy();
  });

  it('asks a guest with an existing account to log in inline and keeps the wizard data', async () => {
    let attempts = 0;
    mockApi({
      routes: {
        'POST /api/orders': (init) => {
          attempts++;
          if (attempts === 1) {
            return json(409, {
              error: { code: 'ACCOUNT_EXISTS_LOGIN_REQUIRED', message: 'exists', fields: { email: 'validation.accountExistsLogin' } },
            });
          }
          const data = JSON.parse(String((init?.body as FormData).get('data'))) as Record<string, unknown>;
          expect(data.password).toBeUndefined();
          return json(201, { order: orderResult(data), created: true, user: customer });
        },
        'POST /api/auth/login': () => json(200, { ...customer, profile: { fullName: 'Anna', phone: null, country: null, city: null, postalCode: null, street: null, houseNumber: null, addressExtra: null } }),
        'GET /api/orders/o1': () => json(200, orderResult({ title: 'Kinderkamer' })),
      },
    });
    const { router } = renderApp(`/order?service=${uid('s2')}`);
    await screen.findByRole('heading', { level: 2, name: 'Wat wilt u laten maken?' });
    await next();
    await fillUntilContact();
    for (const [label, value] of [
      ['Volledige naam', 'Anna'],
      ['E-mailadres', 'anna@example.com'],
      [/Gsm-nummer/, '+32 470 00 00 00'],
      ['Straat', 'Meir'],
      ['Huisnummer', '1'],
      ['Gemeente', 'Antwerpen'],
      ['Postcode', '2000'],
      ['Land', 'België'],
      ['Kies een wachtwoord', 'lang-genoeg-1'],
      ['Herhaal het wachtwoord', 'lang-genoeg-1'],
    ] as const) {
      await user.type(field(label), value);
    }
    await next();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Aanvraag versturen' }));

    // Back on the contact step with an inline login offer; nothing typed was lost.
    expect(await screen.findByText(/Er bestaat al een account met dit e-mailadres. Meld u aan/)).toBeTruthy();
    expect((field('Straat') as HTMLInputElement).value).toBe('Meir');
    await user.click(screen.getAllByRole('button', { name: 'Meld u aan' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Aanmelden' });
    expect((within(dialog).getByLabelText('E-mailadres') as HTMLInputElement).value).toBe('anna@example.com');
    await user.type(within(dialog).getByLabelText('Wachtwoord', { selector: 'input' }), 'mijn-wachtwoord');
    await user.click(within(dialog).getByRole('button', { name: 'Aanmelden' }));

    expect(await screen.findByText(/U bent aangemeld als anna@example.com/)).toBeTruthy();
    expect((field('Gemeente') as HTMLInputElement).value).toBe('Antwerpen');
    expect(screen.queryByLabelText('Kies een wachtwoord')).toBeNull();
    await next();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Aanvraag versturen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/order/confirmation/o1'));
  });

  it('rejects unsupported files on the client with a per-file message', async () => {
    mockApi();
    renderApp(`/order?service=${uid('s1')}`);
    await screen.findByRole('heading', { level: 2, name: 'Wat wilt u laten maken?' });
    await next();
    await user.type(field('Breedte'), '60');
    await user.type(field('Hoogte'), '40');
    await next();
    const gif = new File(['GIF89a'], 'anim.gif', { type: 'image/gif' });
    await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText('Afbeeldingen kiezen', { selector: 'input', exact: false }) as HTMLInputElement, gif);
    expect(await screen.findByText(/anim.gif: Enkel JPG-, PNG- en WebP-afbeeldingen zijn toegestaan./)).toBeTruthy();
    expect(screen.getByText('0 van 8 afbeeldingen')).toBeTruthy();
    expect(portfolio.length).toBeGreaterThan(0);
  });
});
