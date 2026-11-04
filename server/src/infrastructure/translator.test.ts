import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator, TranslatorError } from './translator';

afterEach(() => vi.unstubAllGlobals());

/** `fetch` is mocked: the tests never reach DeepL. */
function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('DeepL translator', () => {
  it('is not configured without an API key', () => {
    expect(createTranslator(undefined).configured).toBe(false);
  });

  it('sends the text with the key and the DeepL target language, and uses the free host for ":fx" keys', async () => {
    const fetchMock = stubFetch(Response.json({ translations: [{ detected_source_language: 'NL', text: 'Mavi de olur mu?' }] }));
    const text = await createTranslator('secret-key:fx').translate('Kan het ook in het blauw?', 'tr');
    expect(text).toBe('Mavi de olur mu?');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api-free.deepl.com/v2/translate');
    expect((init.headers as Record<string, string>).Authorization).toBe('DeepL-Auth-Key secret-key:fx');
    expect(JSON.parse(String(init.body))).toEqual({ text: ['Kan het ook in het blauw?'], target_lang: 'TR' });
  });

  it('uses the paid host otherwise and British English for "en"', async () => {
    const fetchMock = stubFetch(Response.json({ translations: [{ text: 'Hello' }] }));
    await createTranslator('paid-key').translate('Hallo', 'en');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.deepl.com/v2/translate');
    expect(JSON.parse(String(init.body)).target_lang).toBe('EN-GB');
  });

  it('turns DeepL errors and network failures into TranslatorError with the status', async () => {
    stubFetch(new Response('quota', { status: 456 }));
    await expect(createTranslator('k').translate('Hallo', 'en')).rejects.toMatchObject({ name: 'TranslatorError', status: 456 });
    stubFetch(new TypeError('fetch failed'));
    const error = await createTranslator('k').translate('Hallo', 'en').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TranslatorError);
    expect((error as TranslatorError).status).toBeNull();
  });
});
