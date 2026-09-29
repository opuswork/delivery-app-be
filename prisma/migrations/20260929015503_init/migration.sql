-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "loginId" CHAR(4) NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" VARCHAR(50) NOT NULL,
    "churchName" VARCHAR(100) NOT NULL DEFAULT 'joongang',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_records" (
    "delivery_number" SERIAL NOT NULL,
    "company_name" VARCHAR(100) NOT NULL,
    "product_name" VARCHAR(100) NOT NULL,
    "product_quantity" VARCHAR(50) NOT NULL,
    "delivery_date" VARCHAR(10) NOT NULL,
    "userid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_records_pkey" PRIMARY KEY ("delivery_number")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_loginId_key" ON "users"("loginId");

-- CreateIndex
CREATE INDEX "delivery_records_userid_delivery_date_idx" ON "delivery_records"("userid", "delivery_date");

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business-format constraints (hand-written; Prisma schema cannot express these).
-- Login ID: exactly 4 numeric digits.
ALTER TABLE "users" ADD CONSTRAINT "users_loginId_format_check" CHECK ("loginId" ~ '^[0-9]{4}$');
-- Password column must hold a bcrypt hash, never the plaintext 8-digit password.
ALTER TABLE "users" ADD CONSTRAINT "users_password_hash_check" CHECK ("password" ~ '^\$2[aby]\$[0-9]{2}\$.{53}$');
-- Delivery date: yyyy-mm-dd with a valid month (01-12) and day (01-31).
-- Full calendar validity (e.g. no 02-30) is enforced by the API DTO.
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_date_format_check"
  CHECK ("delivery_date" ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
