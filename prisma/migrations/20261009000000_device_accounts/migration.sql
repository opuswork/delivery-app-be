-- The app no longer has a login: each installation gets an anonymous account,
-- found by the SHA-256 of a random key kept on the device. Existing members
-- keep their rows (and deliveries); their login fields are no longer used.
ALTER TABLE "users"
    ADD COLUMN "deviceKeyHash" CHAR(64),
    ALTER COLUMN "loginId" DROP NOT NULL,
    ALTER COLUMN "password" DROP NOT NULL,
    ALTER COLUMN "fullName" SET DEFAULT '';

CREATE UNIQUE INDEX "users_deviceKeyHash_key" ON "users"("deviceKeyHash");
