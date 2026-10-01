-- People who share the middle 4 phone digits share a login ID; the password
-- (which ends in the phone's last 4 digits) tells them apart.
DROP INDEX "users_loginId_key";
CREATE INDEX "users_loginId_idx" ON "users"("loginId");
