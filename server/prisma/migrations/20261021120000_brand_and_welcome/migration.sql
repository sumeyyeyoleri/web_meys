-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "welcomeEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "welcomeImageUrl" TEXT;

-- The site is named MeysArt (PROMPT.md §18.1). Only the untouched seed placeholder is renamed.
UPDATE "SiteSettings" SET "businessName" = 'MeysArt' WHERE "businessName" = 'Atelier Voorbeeld';
