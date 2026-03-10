-- IST Valuation Platform — MySQL init script
-- Runs once when the container is first created.
-- Prisma migrations handle schema; this ensures the DB + charset exist.

CREATE DATABASE IF NOT EXISTS `ist_valuation`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `ist_valuation`.* TO 'ist_user'@'%';
FLUSH PRIVILEGES;
