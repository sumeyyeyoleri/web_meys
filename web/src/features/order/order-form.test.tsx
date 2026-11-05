import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateOrderResultDto, OrderDetailDto } from '@painter/shared';
import { setLocale } from '../../lib/i18n';
import { json, mockApi, uid } from '../../test/fixtures';
import { renderApp } from '../../test/render';

beforeEach(() => setLocale('nl-BE'));
afterEach(() => vi.unstubAllGlobals());

const user = userEvent.setup();
const field = (name: RegExp | string) => screen.getByLabelText(name, { selector: 'input,textarea,select' }) as HTMLInputElement;
const submitButton = () => screen.getByRole('button', { name: 'Bestelling versturen' });
const TRACKING_URL = 'http://localhost:5173/track#AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde';

function orderResult(data: Record<string, unknown>): OrderDetailDto {
  return {
    id: 'o1',
    reference: 'ORD-2026-7K3QXM',
    title: 'Maanlichtheuvels',
    status: 'SUBMITTED',
    serviceName: 'Muurschildering',
    quoteAmount: null,
    unreadMessages: 0,
    createdAt: '2026-11-04T10:00:00.000Z',
    updatedAt: '2026-11-04T10:00:00.000Z',
    inspiration: data.inspirationItemId ? { id: uid('a2'), title: 'Maanlichtheuvels', imageUrl: '/media/portfolio/maanlichtheuvels.svg' } : null,
  } as OrderDetailDto;
}

function orderCreated(data: Record<string, unknown>, emailSent = true): CreateOrderResultDto {
  return {
    order: orderResult(data),
    created: true,
    tracking: { url: TRACKING_URL, expiresAt: '2027-11-04T10:00:00.000Z', emailSent },
  };
}

async function fillRequiredFields() {
  await user.type(field('Breedte'), '30');
  await user.type(field('Hoogte'), '40');
  await user.type(field(/Uw wens/), 'Een rustige nachthemel met heuvels voor de kinderkamer.');
  await user.type(field('Voor- en achternaam'), 'Lotte Peeters');
  await user.type(field(/^Telefoon/), '+32 470 12 34 56');
  await user.type(field('Gemeente'), 'Gent');
  await user.type(field('Postcode'), '9000');
  await user.type(field('Straat'), 'Veldstraat');
  await user.type(field('Huisnummer'), '12');
}

const dataOf = (init: RequestInit | undefined) => JSON.parse(String((init?.body as FormData).get('data'))) as Record<string, unknown>;

describe('order form', () => {
  it('shows every part of the form on one page, with Belgium as the default country', async () => {
    mockApi();
    renderApp('/order');
    await screen.findByRole('heading', { level: 1, name: 'Uw bestelling' });
    expect(await screen.findByRole('radio', { name: /Schilderij op maat/ })).toBeTruthy();
    expect(screen.getByText(/Bijvoorbeeld: 30 × 40 cm/)).toBeTruthy();
    expect(field('Land').value).toBe('België');
    expect(field(/E-mailadres/)).toBeTruthy();
    expect(screen.getByLabelText('Bestanden kiezen', { selector: 'input' })).toBeTruthy();
    expect(screen.queryByLabelText(/Budget/)).toBeNull();
    expect(screen.queryByLabelText(/datum/i)).toBeNull();
    expect(screen.queryByLabelText(/wachtwoord/i)).toBeNull();
    // Nobody needs an account.
    expect(screen.queryByRole('button', { name: 'Meld u aan' })).toBeNull();
  });

  it('validates on the client with the shared schema and focuses the first invalid field', async () => {
    const fetchMock = mockApi();
    renderApp('/order');
    await screen.findByRole('heading', { level: 1, name: 'Uw bestelling' });
    await user.click(submitButton());
    expect((await screen.findAllByText('Dit veld is verplicht.')).length).toBeGreaterThanOrEqual(8);
    expect(screen.getByText('U moet de privacyverklaring aanvaarden om verder te gaan.')).toBeTruthy();
    await waitFor(() => expect((document.activeElement as HTMLInputElement).name).toBe('width'));

    await user.clear(field('Land'));
    await user.type(field('Breedte'), '-1');
    await user.type(field(/^Telefoon/), '0470');
    await user.click(submitButton());
    expect(await screen.findByText('Vul een getal groter dan 0 in.')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('starts from a catalog work: banner, reference and matching service, with a Remove button', async () => {
    let sent: Record<string, unknown> = {};
    mockApi({
      routes: {
        'POST /api/orders': (init) => {
          sent = dataOf(init);
          return json(201, orderCreated(sent));
        },
      },
    });
    renderApp(`/order?from=${uid('a2')}`);
    expect(await screen.findByText(/U vertrekt van het werk ‘Maanlichtheuvels’/)).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('radio', { name: /Muurschildering/ }) as HTMLInputElement).checked).toBe(true));

    await fillRequiredFields();
    await user.click(screen.getByRole('checkbox', { name: /privacyverklaring/ }));
    await user.click(submitButton());
    await screen.findByRole('heading', { name: 'Bedankt voor uw bestelling' });
    expect(sent).toMatchObject({ inspirationItemId: uid('a2'), serviceId: uid('s2') });
  });

  it('switches the unit to the chosen service (m for walls, cm for canvas) until the customer picks one', async () => {
    mockApi();
    renderApp('/order');
    const unit = () => field('Eenheid').value;
    await user.click(await screen.findByRole('radio', { name: /Muurschildering/ }));
    expect(unit()).toBe('M');
    await user.click(screen.getByRole('radio', { name: /Schilderij op maat/ }));
    expect(unit()).toBe('CM');
    // Once the customer chose a unit, changing the service leaves it alone.
    await user.selectOptions(field('Eenheid'), 'M');
    await user.click(screen.getByRole('radio', { name: /Muurschildering/ }));
    await user.click(screen.getByRole('radio', { name: /Schilderij op maat/ }));
    expect(unit()).toBe('M');
  });

  it('uses the unit of the service matched to a catalog work', async () => {
    mockApi();
    renderApp(`/order?from=${uid('a2')}`);
    await waitFor(() => expect((screen.getByRole('radio', { name: /Muurschildering/ }) as HTMLInputElement).checked).toBe(true));
    expect(field('Eenheid').value).toBe('M');
  });

  it('removes the catalog work when asked', async () => {
    let sent: Record<string, unknown> = {};
    mockApi({ routes: { 'POST /api/orders': (init) => ((sent = dataOf(init)), json(201, orderCreated(sent))) } });
    renderApp(`/order?from=${uid('a2')}`);
    await screen.findByText(/U vertrekt van het werk ‘Maanlichtheuvels’/);
    await user.click(screen.getByRole('button', { name: 'Verwijderen' }));
    expect(screen.queryByText(/U vertrekt van het werk/)).toBeNull();
    await fillRequiredFields();
    await user.click(screen.getByRole('checkbox', { name: /privacyverklaring/ }));
    await user.click(submitButton());
    await screen.findByRole('heading', { name: 'Bedankt voor uw bestelling' });
    expect(sent.inspirationItemId).toBe('');
  });

  it('sends the order once and shows the order number and the private link', async () => {
    let sent: FormData | undefined;
    let posts = 0;
    let release: () => void = () => {};
    mockApi({
      routes: {
        'POST /api/orders': async (init) => {
          posts++;
          sent = init?.body as FormData;
          await new Promise<void>((resolve) => (release = resolve));
          return json(201, orderCreated(dataOf(init)));
        },
      },
    });
    const { router } = renderApp(`/order?service=${uid('s1')}`);
    await screen.findByRole('heading', { level: 1, name: 'Uw bestelling' });
    await fillRequiredFields();
    await user.type(field(/E-mailadres/), 'lotte@example.be');
    const photo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'muur.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Bestanden kiezen', { selector: 'input' }), photo);
    expect(await screen.findByText('1 van 8 foto\'s')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'muur.png' })).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: /privacyverklaring/ }));

    await user.click(submitButton());
    // Double-submit protection: the button is disabled while sending.
    await waitFor(() => expect((screen.getByRole('button', { name: /Bezig met versturen/ }) as HTMLButtonElement).disabled).toBe(true));
    await user.click(screen.getByRole('button', { name: /Bezig met versturen/ }));
    release();

    await waitFor(() => expect(router.state.location.pathname).toBe('/order/sent'));
    expect(posts).toBe(1);
    const data = JSON.parse(String(sent!.get('data'))) as Record<string, unknown>;
    expect(data).toMatchObject({
      serviceId: uid('s1'),
      width: 30,
      height: 40,
      unit: 'CM',
      email: 'lotte@example.be',
      phone: '+32 470 12 34 56',
      country: 'België',
      communicationLocale: 'nl-BE',
      privacyAccepted: true,
    });
    expect(data).not.toHaveProperty('password');
    expect(String(data.idempotencyKey)).toMatch(/^[0-9a-f-]{36}$/);
    expect((sent!.getAll('files')[0] as File).name).toBe('muur.png');

    expect(await screen.findByText('ORD-2026-7K3QXM')).toBeTruthy();
    expect((screen.getByLabelText('Persoonlijke link naar uw bestelling') as HTMLInputElement).value).toBe(TRACKING_URL);
    expect(screen.getByText('Bewaar deze link.')).toBeTruthy();
    expect(screen.getByText('We stuurden de link ook naar lotte@example.be.')).toBeTruthy();
  });

  it('saves the site language as the communication language and works without an email address', async () => {
    await setLocale('tr');
    let sent: Record<string, unknown> = {};
    mockApi({ routes: { 'POST /api/orders': (init) => ((sent = dataOf(init)), json(201, orderCreated(sent, false))) } });
    renderApp('/order');
    await screen.findByRole('heading', { level: 1, name: 'Siparişiniz' });
    expect(field('Ülke').value).toBe('Belçika');
    await user.type(field('Genişlik'), '30');
    await user.type(field('Yükseklik'), '40');
    await user.type(field(/İstek/), 'Yumuşak mavi tonlarda sakin bir manzara istiyorum.');
    await user.type(field('Ad Soyad'), 'Ayşe Yılmaz');
    await user.type(field(/^Telefon/), '+32 470 12 34 56');
    await user.type(field('Şehir'), 'Gent');
    await user.type(field('Posta kodu'), '9000');
    await user.type(field('Sokak'), 'Veldstraat');
    await user.type(field('Kapı numarası'), '3');
    await user.click(screen.getByRole('checkbox', { name: /Gizlilik/ }));
    await user.click(screen.getByRole('button', { name: 'Siparişi Gönder' }));
    expect(await screen.findByText('Bu linki saklayın.')).toBeTruthy();
    expect(sent.communicationLocale).toBe('tr');
    expect(sent.email).toBeUndefined();
    expect(screen.queryByText(/adresine de gönderdik/)).toBeNull();
  });

  it('shows server-side field errors on the right fields', async () => {
    mockApi({
      routes: {
        'POST /api/orders': () =>
          json(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid', fields: { postalCode: 'validation.required', 'files.0': 'validation.fileType' } } }),
      },
    });
    renderApp('/order');
    await screen.findByRole('heading', { level: 1, name: 'Uw bestelling' });
    await fillRequiredFields();
    const photo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'nep.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Bestanden kiezen', { selector: 'input' }), photo);
    await user.click(screen.getByRole('checkbox', { name: /privacyverklaring/ }));
    await user.click(submitButton());
    expect(await screen.findByText('Dit veld is verplicht.')).toBeTruthy();
    expect(field('Postcode').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enkel JPG-, PNG- en WebP-afbeeldingen zijn toegestaan.')).toBeTruthy();
  });

  it('applies the file rules on the client', async () => {
    mockApi();
    renderApp('/order');
    await screen.findByRole('heading', { level: 1, name: 'Uw bestelling' });
    const input = screen.getByLabelText('Bestanden kiezen', { selector: 'input' }) as HTMLInputElement;
    const gif = new File(['GIF89a'], 'anim.gif', { type: 'image/gif' });
    await userEvent.setup({ applyAccept: false }).upload(input, gif);
    expect(await screen.findByText(/anim.gif: Enkel JPG-, PNG- en WebP-afbeeldingen zijn toegestaan./)).toBeTruthy();

    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'groot.jpg', { type: 'image/jpeg' });
    await user.upload(input, big);
    expect(await screen.findByText(/groot.jpg:/)).toBeTruthy();

    const nine = Array.from({ length: 9 }, (_, i) => new File([new Uint8Array([1])], `f${i}.png`, { type: 'image/png' }));
    await user.upload(input, nine);
    expect(await screen.findByText('8 van 8 foto\'s')).toBeTruthy();
    expect(screen.getByText(/1 bestand\(en\) werden niet toegevoegd/)).toBeTruthy();
    expect(input.disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: 'f0.png verwijderen' }));
    expect(screen.getByText('7 van 8 foto\'s')).toBeTruthy();
  });

  it('warns before leaving with unsaved data', async () => {
    mockApi();
    const { router } = renderApp('/order');
    await screen.findByRole('heading', { level: 1, name: 'Uw bestelling' });
    await user.type(field(/Uw wens/), 'Iets');
    await user.click(screen.getByRole('link', { name: /Terug naar de catalogus/ }));
    expect(await screen.findByRole('dialog', { name: 'Pagina verlaten?' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/order');
  });
});

describe('tracking page', () => {
  it('opens the order with the token from the link and rejects a bad link', async () => {
    const fetchMock = mockApi({
      routes: {
        'GET /api/track/order': (init) =>
          (init?.headers as Record<string, string>)['X-Order-Token'] === 'good-token'
            ? json(200, { ...orderResult({}), width: 30, height: 40, unit: 'CM', description: 'Duinen bij zonsondergang.', statusHistory: [{ id: 'h1', fromStatus: null, toStatus: 'SUBMITTED', changedByRole: 'CUSTOMER', note: null, quoteAmount: null, createdAt: '2026-11-04T10:00:00.000Z' }] })
            : json(404, { error: { code: 'NOT_FOUND', message: 'Order not found' } }),
      },
    });
    renderApp('/track#good-token');
    expect(await screen.findByText('ORD-2026-7K3QXM')).toBeTruthy();
    expect(screen.getByText('Duinen bij zonsondergang.')).toBeTruthy();
    // The token travels in a header, never in the URL.
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/track/order'))!;
    expect(String(call[0])).not.toContain('good-token');
  });

  it('explains when the link does not work', async () => {
    mockApi({ routes: { 'GET /api/track/order': () => json(404, { error: { code: 'NOT_FOUND', message: 'Order not found' } }) } });
    renderApp('/track#wrong');
    expect(await screen.findByRole('heading', { name: 'Deze link werkt niet' })).toBeTruthy();
  });
});
