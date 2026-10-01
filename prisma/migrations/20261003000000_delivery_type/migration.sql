-- 납품종류 (런 / 두부 / 간장) between 납품처 and the memo. Existing rows get an
-- empty value and are shown without a type colour until they are next edited.
-- The '' default stays so code deployed before or after this migration can save.
ALTER TABLE "delivery_records" ADD COLUMN "delivery_type" VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_delivery_type_check"
  CHECK ("delivery_type" IN ('', '런', '두부', '간장'));
