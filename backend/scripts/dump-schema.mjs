// Verify the live DB schema matches what Prisma Client expects for the tables
// touched during the chat flow. Lists columns actually present in each table.

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envText = readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let [, k, v] = m;
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const prisma = new PrismaClient();

const tables = [
  'users',
  'buyer_demands',
  'merchants',
  'stalls',
  'stall_attendants',
  'seller_offers',
  'chat_rooms',
  'chat_messages',
];

for (const table of tables) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name, is_nullable
     FROM information_schema.columns
     WHERE table_name = $1 AND table_schema = 'public'
     ORDER BY ordinal_position`,
    table,
  );
  console.log(`\n=== ${table} (${rows.length} columns) ===`);
  for (const r of rows) {
    console.log(`  ${r.column_name.padEnd(30)} ${r.data_type.padEnd(25)} ${r.udt_name.padEnd(15)} ${r.is_nullable === 'NO' ? 'NOT NULL' : 'nullable'}`);
  }
}

await prisma.$disconnect();
