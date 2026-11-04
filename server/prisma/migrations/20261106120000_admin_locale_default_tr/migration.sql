-- The dashboard is Turkish by default (PROMPT.md §10). Until now the artist could not choose a
-- language anywhere, so the stored value is always the old default and can be updated safely.
ALTER TABLE "User" ALTER COLUMN "preferredLocale" SET DEFAULT 'TR';
UPDATE "User" SET "preferredLocale" = 'TR';
