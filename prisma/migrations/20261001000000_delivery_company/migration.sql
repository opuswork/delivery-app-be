-- 납품처 is its own field again; the memo becomes optional (empty string).
-- Existing rows get an empty 납품처: their company name is still inside the
-- memo and is filled in when the record is next edited.
ALTER TABLE "delivery_records" ADD COLUMN "company_name" VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE "delivery_records" ALTER COLUMN "company_name" DROP DEFAULT;
