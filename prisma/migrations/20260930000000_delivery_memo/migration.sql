-- Deliveries are now just a date and a free-text memo.
-- Existing rows keep their content: "납품처 상품명 수량" becomes the memo.
ALTER TABLE "delivery_records" ADD COLUMN "memo" VARCHAR(1000);

UPDATE "delivery_records"
SET "memo" = concat_ws(' ', "company_name", "product_name", "product_quantity");

ALTER TABLE "delivery_records" ALTER COLUMN "memo" SET NOT NULL;

ALTER TABLE "delivery_records"
  DROP COLUMN "company_name",
  DROP COLUMN "product_name",
  DROP COLUMN "product_quantity";
