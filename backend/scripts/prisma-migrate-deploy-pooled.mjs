/**
 * DigitalOcean Postgres (and similar) often use PgBouncer on the pooled port.
 * Prisma migrate needs an advisory lock; the pooler can block it (P1002).
 * This one-shot disables the advisory lock for migrate deploy only.
 * Prefer a direct (non-pooler) DATABASE_URL or schema `directUrl` when available.
 * @see https://www.prisma.io/docs/orm/prisma-migrate/workflows/pgbouncer
 */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = '1';

const r = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
process.exit(r.status ?? 1);
