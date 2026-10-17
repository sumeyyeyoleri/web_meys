import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const optionalNonEmpty = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? undefined : value.trim()));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    WEB_ORIGIN: z.url({ protocol: /^https?$/ }).transform((value) => new URL(value).origin),
    /** Number of reverse proxies in front of the app (for correct client IPs in rate limiting). */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_PUBLIC_DIR: z.string().default('./storage/public'),
    STORAGE_LOCAL_PRIVATE_DIR: z.string().default('./storage/private'),

    S3_REGION: optionalNonEmpty,
    S3_ENDPOINT: optionalNonEmpty,
    S3_ACCESS_KEY_ID: optionalNonEmpty,
    S3_SECRET_ACCESS_KEY: optionalNonEmpty,
    S3_PUBLIC_BUCKET: optionalNonEmpty,
    S3_PRIVATE_BUCKET: optionalNonEmpty,
    S3_PUBLIC_BASE_URL: optionalNonEmpty,
    S3_FORCE_PATH_STYLE: booleanFromString,

    SMTP_HOST: optionalNonEmpty,
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_SECURE: booleanFromString,
    SMTP_USER: optionalNonEmpty,
    SMTP_PASSWORD: optionalNonEmpty,
    SMTP_FROM: optionalNonEmpty,
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_REGION', 'S3_PUBLIC_BUCKET', 'S3_PRIVATE_BUCKET', 'S3_PUBLIC_BASE_URL'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required when STORAGE_DRIVER=s3` });
      }
    }
    if (env.SMTP_HOST && !env.SMTP_FROM) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_FROM'], message: 'SMTP_FROM is required when SMTP_HOST is set' });
    }
    if (env.NODE_ENV === 'production' && env.SESSION_SECRET.startsWith('change-me')) {
      ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'Set a real SESSION_SECRET in production' });
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  sessionTtlMs: number;
  webOrigin: string;
  trustProxy: number;
  storage:
    | { driver: 'local'; publicDir: string; privateDir: string }
    | {
        driver: 's3';
        region: string;
        endpoint: string | undefined;
        accessKeyId: string | undefined;
        secretAccessKey: string | undefined;
        publicBucket: string;
        privateBucket: string;
        publicBaseUrl: string;
        forcePathStyle: boolean;
      };
  smtp:
    | { host: string; port: number; secure: boolean; user: string | undefined; password: string | undefined; from: string }
    | null;
}

/** Parses and validates the environment. Throws (fail fast) on bad configuration. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const env = parsed.data;
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    sessionSecret: env.SESSION_SECRET,
    sessionTtlMs: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    webOrigin: env.WEB_ORIGIN,
    trustProxy: env.TRUST_PROXY,
    storage:
      env.STORAGE_DRIVER === 'local'
        ? { driver: 'local', publicDir: env.STORAGE_LOCAL_PUBLIC_DIR, privateDir: env.STORAGE_LOCAL_PRIVATE_DIR }
        : {
            driver: 's3',
            region: env.S3_REGION!,
            endpoint: env.S3_ENDPOINT,
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            publicBucket: env.S3_PUBLIC_BUCKET!,
            privateBucket: env.S3_PRIVATE_BUCKET!,
            publicBaseUrl: env.S3_PUBLIC_BASE_URL!.replace(/\/+$/, ''),
            forcePathStyle: env.S3_FORCE_PATH_STYLE,
          },
    smtp: env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          user: env.SMTP_USER,
          password: env.SMTP_PASSWORD,
          from: env.SMTP_FROM!,
        }
      : null,
  };
}
