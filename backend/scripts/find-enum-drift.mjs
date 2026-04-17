// Compare enum values used in the database against the Prisma schema enums
// touched by the chat-rooms query. P2023 fires when the DB contains a value
// not in the current enum definition.

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');
const envText = readFileSync(envPath, 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let [, k, v] = m;
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const schemaText = readFileSync(path.resolve(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');

function parseEnum(name) {
  const re = new RegExp(`enum\\s+${name}\\s*\\{([^}]+)\\}`, 'm');
  const m = schemaText.match(re);
  if (!m) return null;
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .map((l) => l.split(/\s+/)[0]);
}

const prisma = new PrismaClient();

const checks = [
  { enumName: 'OfferStatus',    table: 'seller_offers',   column: 'status' },
  { enumName: 'MerchantStatus', table: 'merchants',       column: 'status' },
  { enumName: 'StallStatus',    table: 'stalls',          column: 'status' },
  { enumName: 'UserStatus',     table: 'users',           column: 'status' },
  { enumName: 'UserRole',       table: 'users',           column: 'role' },
];

for (const { enumName, table, column } of checks) {
  const schemaValues = parseEnum(enumName) ?? [];
  let dbRows;
  try {
    dbRows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "${column}"::text AS v, COUNT(*)::int AS c
       FROM "${table}"
       GROUP BY "${column}"`,
    );
  } catch (e) {
    console.log(`ERR: ${table}.${column} — ${e.message.split('\n')[0]}`);
    continue;
  }
  const dbValues = dbRows.map((r) => r.v);
  const schemaSet = new Set(schemaValues);
  const unknown = dbRows.filter((r) => r.v && !schemaSet.has(r.v));

  console.log(`\n=== ${enumName}  (${table}.${column}) ===`);
  console.log(`  schema: ${schemaValues.join(', ')}`);
  console.log(`  db    : ${dbValues.map((v) => `${v}`).join(', ')}`);
  if (unknown.length) {
    console.log(`  ⚠️  UNKNOWN DB VALUES (cause P2023):`);
    for (const u of unknown) {
      console.log(`      ${JSON.stringify(u.v)} × ${u.c} row(s)`);
    }
  } else {
    console.log('  ✓ all DB values match schema');
  }
}

await prisma.$disconnect();
