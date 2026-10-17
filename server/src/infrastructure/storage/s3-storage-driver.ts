import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { notFound } from '../../domain/errors';
import { assertSafeKey, type StorageDriver, type StoredObject } from './storage-driver';

export interface S3StorageOptions {
  region: string;
  endpoint: string | undefined;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  publicBucket: string;
  privateBucket: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
}

/**
 * S3-compatible storage. The private bucket must NOT allow public reads; the public
 * bucket (or a CDN in front of it, `publicBaseUrl`) serves portfolio/service images.
 */
export class S3StorageDriver implements StorageDriver {
  readonly localPublicDir = null;
  private readonly client: S3Client;

  constructor(private readonly options: S3StorageOptions) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined,
    });
  }

  async putPrivate(key: string, data: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.options.privateBucket, Key: key, Body: data, ContentType: contentType }),
    );
  }

  async getPrivate(key: string): Promise<StoredObject> {
    assertSafeKey(key);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.options.privateBucket, Key: key }));
      if (!(result.Body instanceof Readable)) throw notFound('File not found');
      return { stream: result.Body, size: result.ContentLength };
    } catch (error) {
      if (error instanceof NoSuchKey) throw notFound('File not found');
      throw error;
    }
  }

  async deletePrivate(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.privateBucket, Key: key }));
  }

  async putPublic(key: string, data: Buffer, contentType: string): Promise<string> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.publicBucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.options.publicBaseUrl}/${key}`;
  }

  async deletePublic(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.publicBucket, Key: key }));
  }

  publicKeyFromUrl(url: string): string | null {
    const prefix = `${this.options.publicBaseUrl}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}
