import type { Readable } from 'node:stream';

export interface StoredObject {
  stream: Readable;
  size: number | undefined;
}

/**
 * Two separate areas:
 * - private: customer reference images, only served through an authorized endpoint;
 * - public: admin-uploaded portfolio/service images, served as static media.
 */
export interface StorageDriver {
  putPrivate(key: string, data: Buffer, contentType: string): Promise<void>;
  getPrivate(key: string): Promise<StoredObject>;
  deletePrivate(key: string): Promise<void>;
  /** Stores a public file and returns the URL under which it is served. */
  putPublic(key: string, data: Buffer, contentType: string): Promise<string>;
  deletePublic(key: string): Promise<void>;
  /** Maps a public URL produced by `putPublic` back to its key, or null if it is not ours. */
  publicKeyFromUrl(url: string): string | null;
  /** Local directory to serve under `/media`, when the driver stores public files on disk. */
  readonly localPublicDir: string | null;
}

/** Keys are generated server-side; this guards against path traversal regardless. */
export function assertSafeKey(key: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error('Unsafe storage key');
  }
}
