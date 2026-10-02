-- 납품처 badge colour chosen per delivery (replaces 납품종류 in the app).
-- Existing rows keep the colour their 납품종류 had; '' means the default colour.
ALTER TABLE "delivery_records" ADD COLUMN "badge_color" VARCHAR(7) NOT NULL DEFAULT '';
UPDATE "delivery_records" SET "badge_color" = CASE "delivery_type"
  WHEN '런' THEN '#1D84C4'
  WHEN '두부' THEN '#B41DC4'
  WHEN '간장' THEN '#413742'
  ELSE ''
END;
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_badge_color_check"
  CHECK ("badge_color" ~ '^(#[0-9A-F]{6})?$');
