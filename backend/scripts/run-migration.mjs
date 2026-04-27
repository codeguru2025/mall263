/**
 * One-shot migration script:
 * 1. Creates _prisma_migrations table if absent
 * 2. Baselines all old migrations (inserts records without running SQL)
 * 3. Runs the new migration SQL and records it
 *
 * Uses a single PrismaClient connection pool — safe on low-connection DBs.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'prisma', 'migrations');
const NEW_MIGRATION = '20260426000000_driver_onboarding_qr';

const prisma = new PrismaClient({ log: [] });

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function getMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f !== 'migration_lock.toml' && statSync(join(MIGRATIONS_DIR, f)).isDirectory())
    .sort();
}

async function main() {
  console.log('Connecting to database...');

  // Ensure _prisma_migrations table exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                  VARCHAR(36)  NOT NULL PRIMARY KEY,
      "checksum"            VARCHAR(64)  NOT NULL,
      "finished_at"         TIMESTAMPTZ,
      "migration_name"      VARCHAR(255) NOT NULL,
      "logs"                TEXT,
      "rolled_back_at"      TIMESTAMPTZ,
      "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER      NOT NULL DEFAULT 0
    )
  `);
  console.log('_prisma_migrations table ready');

  const migrations = getMigrations();
  console.log(`Found ${migrations.length} migration directories`);

  for (const name of migrations) {
    const sqlPath = join(MIGRATIONS_DIR, name, 'migration.sql');
    let sql;
    try {
      sql = readFileSync(sqlPath, 'utf8');
    } catch {
      console.log(`  SKIP ${name} (no migration.sql)`);
      continue;
    }

    const checksum = sha256(sql);

    // Check if already recorded
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1`,
      name,
    );
    if (existing.length > 0) {
      console.log(`  ALREADY RECORDED: ${name}`);
      continue;
    }

    if (name === NEW_MIGRATION) {
      // Actually run the SQL for the new migration
      console.log(`  APPLYING: ${name}`);
      try {
        // Split on statement boundaries (semicolons) and run each statement
        const statements = sql
          .split(/;\s*\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
          const full = stmt.endsWith(';') ? stmt : stmt + ';';
          try {
            await prisma.$executeRawUnsafe(full);
          } catch (err) {
            // Log but continue — some ALTER ENUM statements may already exist
            const msg = err.message ?? String(err);
            if (msg.includes('already exists') || msg.includes('duplicate')) {
              console.log(`    (already exists, skipped): ${full.slice(0, 60)}...`);
            } else {
              throw err;
            }
          }
        }
      } catch (err) {
        console.error(`  FAILED: ${name}`, err.message);
        process.exit(1);
      }

      // Record as applied
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
        checksum,
        name,
      );
      console.log(`  APPLIED AND RECORDED: ${name}`);
    } else {
      // Baseline: record without running
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
        checksum,
        name,
      );
      console.log(`  BASELINED: ${name}`);
    }
  }

  console.log('\nAll migrations processed successfully.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
