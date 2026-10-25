-- GST tax invoices for credit-pack purchases.
BEGIN;
CREATE TABLE IF NOT EXISTS invoice_counters (
  series text PRIMARY KEY,
  last integer NOT NULL
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "invoiceNumber" text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "supplierGstin" text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "placeOfSupply" text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "gstRate" numeric(5,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "taxableAmount" numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "cgstAmount" numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "sgstAmount" numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "igstAmount" numeric(10,2);
CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_uq ON orders ("invoiceNumber") WHERE "invoiceNumber" IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "billingState" text;
COMMIT;
