import path from 'node:path';
import type { AppConfig } from '../../config/env';
import { LocalStorageDriver } from './local-storage-driver';
import { S3StorageDriver } from './s3-storage-driver';
import type { StorageDriver } from './storage-driver';

export type { StorageDriver, StoredObject } from './storage-driver';

/** Relative local storage paths resolve against the working directory (the `server` package). */
export function createStorageDriver(config: AppConfig['storage']): StorageDriver {
  if (config.driver === 's3') return new S3StorageDriver(config);
  return new LocalStorageDriver(path.resolve(config.publicDir), path.resolve(config.privateDir));
}
