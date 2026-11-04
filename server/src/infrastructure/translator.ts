import type { Locale } from '@painter/shared';
import { describeError, logger } from './logger';

export interface Translator {
  /** True when a DeepL API key is configured. */
  readonly configured: boolean;
  /** Translates `text` into `target`. Throws `TranslatorError` when the service fails. */
  translate(text: string, target: Locale): Promise<string>;
}

export class TranslatorError extends Error {
  constructor(
    message: string,
    /** DeepL's HTTP status (e.g. 456 quota exceeded, 429 too many requests); null for network errors. */
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'TranslatorError';
  }
}

/** DeepL target language codes. */
const DEEPL_TARGET: Record<Locale, string> = { 'nl-BE': 'NL', en: 'EN-GB', tr: 'TR' };
const TIMEOUT_MS = 10_000;

class DeepLTranslator implements Translator {
  readonly configured = true;
  private readonly endpoint: string;

  constructor(private readonly apiKey: string) {
    // Free-plan keys end in ":fx" and use their own host.
    const host = apiKey.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
    this.endpoint = `https://${host}/v2/translate`;
  }

  async translate(text: string, target: Locale): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}`, 'Content-Type': 'application/json' },
        // The source language is detected by DeepL: people do not always write in their own language.
        body: JSON.stringify({ text: [text], target_lang: DEEPL_TARGET[target] }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      logger.error('Translation request failed', describeError(error));
      throw new TranslatorError('Translation service unreachable', null);
    }
    if (!response.ok) {
      logger.error('Translation request rejected', { status: response.status });
      throw new TranslatorError('Translation service rejected the request', response.status);
    }
    const data = (await response.json()) as { translations?: Array<{ text?: unknown }> };
    const translated = data.translations?.[0]?.text;
    if (typeof translated !== 'string') throw new TranslatorError('Unexpected translation response', response.status);
    return translated;
  }
}

const unconfigured: Translator = {
  configured: false,
  translate() {
    return Promise.reject(new TranslatorError('Translation is not configured', null));
  },
};

/** Without DEEPL_API_KEY the site works normally, only without the "Translate" button. */
export function createTranslator(apiKey: string | undefined): Translator {
  return apiKey ? new DeepLTranslator(apiKey) : unconfigured;
}
