-- Customer accounts are removed (PROMPT.md §7): only the artist logs in; customers follow
-- their orders through the private tracking link. Orders, messages, attachments and status
-- history are all kept — they are detached from the customer accounts first, and the order
-- keeps the contact details exactly as submitted.

-- 1. Detach customer activity from the accounts (the side stays recorded as CUSTOMER).
UPDATE "OrderMessage" SET "senderId" = NULL
  WHERE "senderId" IN (SELECT "id" FROM "User" WHERE "role" = 'CUSTOMER');
UPDATE "OrderStatusHistory" SET "changedById" = NULL
  WHERE "changedById" IN (SELECT "id" FROM "User" WHERE "role" = 'CUSTOMER');

-- 2. Orders no longer belong to an account.
ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";
DROP INDEX "Order_customerId_idx";
ALTER TABLE "Order" DROP COLUMN "customerId";

-- 3. Delete the customer accounts. Their sessions, reset tokens, notifications and profile
--    rows are removed with them (ON DELETE CASCADE). Fails safely (RESTRICT) if a customer
--    account were still referenced anywhere else.
DELETE FROM "User" WHERE "role" = 'CUSTOMER';

-- 4. Remove what only existed for customer accounts.
DROP TABLE "CustomerProfile";
ALTER TABLE "User" DROP COLUMN "role";

-- 5. The email address is optional in the order form; the phone number is required instead.
ALTER TABLE "Order" ALTER COLUMN "contactEmail" DROP NOT NULL;
