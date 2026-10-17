import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { notFound } from '../../domain/errors';
import { assertSafeKey, type StorageDriver, type StoredObject } from './storage-driver';

export const PUBLIC_MEDIA_PREFIX = '/media/';

export class LocalStorageDriver implements StorageDriver {
  readonly localPublicDir: string;
  private readonly privateDir: string;

  constructor(publicDir: string, privateDir: string) {
    this.localPublicDir = path.resolve(publicDir);
    this.privateDir = path.resolve(privateDir);
  }

  private resolve(baseDir: string, key: string): string {
    assertSafeKey(key);
    const target = path.resolve(baseDir, key);
    if (!target.startsWith(baseDir + path.sep)) throw new Error('Unsafe storage key');
    return target;
  }

  private async write(baseDir: string, key: string, data: Buffer) {
    const target = this.resolve(baseDir, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async putPrivate(key: string, data: Buffer): Promise<void> {
    await this.write(this.privateDir, key, data);
  }

  async getPrivate(key: string): Promise<StoredObject> {
    const target = this.resolve(this.privateDir, key);
    const info = await stat(target).catch(() => null);
    if (!info?.isFile()) throw notFound('File not found');
    return { stream: createReadStream(target), size: info.size };
  }

  async deletePrivate(key: string): Promise<void> {
    await rm(this.resolve(this.privateDir, key), { force: true });
  }

  async putPublic(key: string, data: Buffer): Promise<string> {
    await this.write(this.localPublicDir, key, data);
    return `${PUBLIC_MEDIA_PREFIX}${key}`;
  }

  async deletePublic(key: string): Promise<void> {
    await rm(this.resolve(this.localPublicDir, key), { force: true });
  }

  publicKeyFromUrl(url: string): string | null {
    return url.startsWith(PUBLIC_MEDIA_PREFIX) ? url.slice(PUBLIC_MEDIA_PREFIX.length) : null;
  }
}
