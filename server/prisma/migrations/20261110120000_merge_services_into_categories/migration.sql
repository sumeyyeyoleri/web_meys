-- Services are merged into categories: one list for the catalog filter, the services page and the
-- order form. Nothing is deleted: every order keeps its former service name as text
-- (serviceLabel), is linked to the closest category where one fits, and the Service tables and
-- Order.serviceId stay in place (unused) until they are removed in a separate migration.

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "defaultUnit" "DimensionUnit",
ADD COLUMN "showInOrderForm" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CategoryTranslation" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "categoryId" UUID,
ADD COLUMN "serviceLabel" TEXT;

-- CreateIndex
CREATE INDEX "Order_categoryId_idx" ON "Order"("categoryId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New category for requests that fit nowhere else: only in the order form, not on the site.
INSERT INTO "Category" ("id", "slug", "isVisible", "showInOrderForm", "defaultUnit", "sortOrder", "updatedAt")
SELECT gen_random_uuid(), 'custom', false, true, 'CM', COALESCE(MAX("sortOrder"), -1) + 1, CURRENT_TIMESTAMP FROM "Category"
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "CategoryTranslation" ("id", "categoryId", "locale", "name")
SELECT gen_random_uuid(), c."id", t."locale"::"Locale", t."name"
FROM (VALUES ('NL_BE', 'Werk op maat'), ('EN', 'Custom piece'), ('TR', 'Kişiye özel eser')) AS t("locale", "name")
JOIN "Category" c ON c."slug" = 'custom'
ON CONFLICT ("categoryId", "locale") DO NOTHING;

-- Default units of the starting categories: wall work in metres, canvas and custom pieces in centimetres.
UPDATE "Category" SET "defaultUnit" = 'M' WHERE "defaultUnit" IS NULL AND "slug" IN ('horeca', 'gym', 'shops', 'home', 'street-art');
UPDATE "Category" SET "defaultUnit" = 'CM' WHERE "defaultUnit" IS NULL AND "slug" IN ('canvas-portrait', 'custom');

-- Every order keeps the name of its former service, in the order's language (Dutch as fallback).
UPDATE "Order" o
SET "serviceLabel" = COALESCE(
    (SELECT st."name" FROM "ServiceTranslation" st WHERE st."serviceId" = o."serviceId" AND st."locale" = o."communicationLocale"),
    (SELECT st."name" FROM "ServiceTranslation" st WHERE st."serviceId" = o."serviceId" AND st."locale" = 'NL_BE')
)
WHERE o."serviceId" IS NOT NULL;

-- Closest category: canvas/portrait → canvas & portrait, shutters & windows → street art,
-- custom piece → custom; other services (e.g. mural) → the category of the catalog work the
-- order started from, if any. Orders that match nothing keep only their serviceLabel.
UPDATE "Order" o
SET "categoryId" = c."id"
FROM "Service" s, "Category" c
WHERE o."serviceId" = s."id"
  AND c."slug" = CASE s."slug"
      WHEN 'canvas-painting' THEN 'canvas-portrait'
      WHEN 'portrait' THEN 'canvas-portrait'
      WHEN 'shutter-window' THEN 'street-art'
      WHEN 'custom-piece' THEN 'custom'
  END;

UPDATE "Order" o
SET "categoryId" = p."categoryId"
FROM "PortfolioItem" p
WHERE o."categoryId" IS NULL AND o."serviceId" IS NOT NULL AND o."inspirationItemId" = p."id" AND p."categoryId" IS NOT NULL;

-- The former services' texts and images fill the matching category where it is still empty.
UPDATE "CategoryTranslation" ct
SET "description" = st."description"
FROM "Category" c, "Service" s, "ServiceTranslation" st
WHERE ct."categoryId" = c."id" AND ct."description" IS NULL
  AND st."serviceId" = s."id" AND st."locale" = ct."locale" AND st."description" IS NOT NULL
  AND (c."slug", s."slug") IN (('canvas-portrait', 'canvas-painting'), ('street-art', 'shutter-window'), ('custom', 'custom-piece'));

UPDATE "Category" c
SET "coverImageUrl" = s."imageUrl"
FROM "Service" s
WHERE c."coverImageUrl" IS NULL AND s."imageUrl" IS NOT NULL
  AND (c."slug", s."slug") IN (('canvas-portrait', 'canvas-painting'), ('street-art', 'shutter-window'), ('custom', 'custom-piece'));
