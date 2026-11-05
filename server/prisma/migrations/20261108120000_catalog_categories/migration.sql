-- Catalog categories become a table the artist manages; the fixed category and space
-- lists go away. Every existing work is moved to the closest new category — no work is
-- deleted. Services get a default dimension unit for the order form.

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryTranslation" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTranslation_categoryId_locale_key" ON "CategoryTranslation"("categoryId", "locale");

-- AddForeignKey
ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Starting categories (the seed uses the same slugs; the artist can rename, hide or delete them).
INSERT INTO "Category" ("id", "slug", "sortOrder", "updatedAt") VALUES
    (gen_random_uuid(), 'horeca', 0, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'gym', 1, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'shops', 2, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'home', 3, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'street-art', 4, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'canvas-portrait', 5, CURRENT_TIMESTAMP);

INSERT INTO "CategoryTranslation" ("id", "categoryId", "locale", "name")
SELECT gen_random_uuid(), c."id", t."locale"::"Locale", t."name"
FROM (VALUES
    ('horeca', 'NL_BE', 'Horeca'), ('horeca', 'EN', 'Cafés & restaurants'), ('horeca', 'TR', 'Horeca'),
    ('gym', 'NL_BE', 'Sportscholen'), ('gym', 'EN', 'Gyms'), ('gym', 'TR', 'Spor salonu'),
    ('shops', 'NL_BE', 'Winkels en bedrijven'), ('shops', 'EN', 'Shops & businesses'), ('shops', 'TR', 'Mağaza ve iş yeri'),
    ('home', 'NL_BE', 'Woning en kinderkamer'), ('home', 'EN', 'Home & kids'' rooms'), ('home', 'TR', 'Ev ve çocuk odası'),
    ('street-art', 'NL_BE', 'Street art en vitrines'), ('street-art', 'EN', 'Street art & shop windows'), ('street-art', 'TR', 'Sokak sanatı ve vitrin'),
    ('canvas-portrait', 'NL_BE', 'Doek en portret'), ('canvas-portrait', 'EN', 'Canvas & portrait'), ('canvas-portrait', 'TR', 'Tuval ve portre')
) AS t("slug", "locale", "name")
JOIN "Category" c ON c."slug" = t."slug";

-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN "categoryId" UUID;

-- Move every work to the closest new category: paintings and portraits to canvas & portrait,
-- the rest by its former spaces (café → horeca, outdoor → street art, kids' room → home,
-- office → shops, anything else → home).
UPDATE "PortfolioItem" p
SET "categoryId" = c."id"
FROM "Category" c
WHERE c."slug" = CASE
    WHEN p."category" IN ('PAINTING', 'PORTRAIT') THEN 'canvas-portrait'
    WHEN 'CAFE_SHOP' = ANY (p."spaces") THEN 'horeca'
    WHEN 'OUTDOOR' = ANY (p."spaces") THEN 'street-art'
    WHEN 'KIDS_ROOM' = ANY (p."spaces") THEN 'home'
    WHEN 'OFFICE' = ANY (p."spaces") THEN 'shops'
    ELSE 'home'
END;

-- DropIndex
DROP INDEX "PortfolioItem_category_idx";

-- AlterTable
ALTER TABLE "PortfolioItem" DROP COLUMN "category",
DROP COLUMN "spaces";

-- DropEnum
DROP TYPE "PortfolioCategory";

-- DropEnum
DROP TYPE "Space";

-- CreateIndex
CREATE INDEX "PortfolioItem_categoryId_idx" ON "PortfolioItem"("categoryId");

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "defaultUnit" "DimensionUnit";

-- Existing seed services: wall work in metres, canvas and portraits in centimetres; the new
-- service line-up puts the mural first, and the portrait and decorative wall painting services
-- are switched off (they stay on their orders; the artist can switch them back on).
UPDATE "Service" SET "defaultUnit" = 'M' WHERE "slug" IN ('mural', 'decorative-wall-painting');
UPDATE "Service" SET "defaultUnit" = 'CM' WHERE "slug" IN ('canvas-painting', 'portrait');
UPDATE "Service" SET "sortOrder" = 0 WHERE "slug" = 'mural';
UPDATE "Service" SET "sortOrder" = 2 WHERE "slug" = 'canvas-painting';
UPDATE "Service" SET "sortOrder" = 4, "isActive" = false WHERE "slug" = 'portrait';
UPDATE "Service" SET "sortOrder" = 5, "isActive" = false WHERE "slug" = 'decorative-wall-painting';
