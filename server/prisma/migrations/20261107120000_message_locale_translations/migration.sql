-- Sender language per message. Existing messages were written in the order's communication language.
ALTER TABLE "OrderMessage" ADD COLUMN "locale" "Locale";
UPDATE "OrderMessage" m SET "locale" = o."communicationLocale" FROM "Order" o WHERE o."id" = m."orderId";
ALTER TABLE "OrderMessage" ALTER COLUMN "locale" SET NOT NULL;

-- Cached DeepL translations (one per message and target language).
CREATE TABLE "MessageTranslation" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "targetLocale" "Locale" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageTranslation_messageId_targetLocale_key" ON "MessageTranslation"("messageId", "targetLocale");

ALTER TABLE "MessageTranslation" ADD CONSTRAINT "MessageTranslation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "OrderMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
