// Finds rows whose UUID-typed columns contain malformed values (the root cause
// of Prisma P2023 errors on the chat inbox). Reads DATABASE_URL from backend/.env.
//
// Usage:  node scripts/find-bad-uuids.mjs

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

const prisma = new PrismaClient();

const UUID_RE = `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`;

const checks = [
  { table: 'buyer_demands',    column: 'buyer_id' },
  { table: 'buyer_demands',    column: 'mall_id' },
  { table: 'merchants',        column: 'user_id' },
  { table: 'merchants',        column: 'onboarded_by_id' },
  { table: 'stalls',           column: 'merchant_id' },
  { table: 'stalls',           column: 'mall_id' },
  { table: 'stall_attendants', column: 'user_id' },
  { table: 'stall_attendants', column: 'stall_id' },
  { table: 'seller_offers',    column: 'demand_id' },
  { table: 'seller_offers',    column: 'stall_id' },
  { table: 'chat_rooms',       column: 'offer_id' },
  { table: 'chat_messages',    column: 'room_id' },
  { table: 'chat_messages',    column: 'sender_id' },
  { table: 'users',            column: 'id' },
];

let totalBad = 0;

for (const { table, column } of checks) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, "${column}"::text AS bad_value
       FROM "${table}"
       WHERE "${column}" IS NOT NULL
         AND "${column}"::text !~ $1
       LIMIT 50`,
      UUID_RE,
    );
    if (rows.length) {
      totalBad += rows.length;
      console.log(`\n${'='.repeat(60)}`);
      console.log(`BAD: ${table}.${column} — ${rows.length} row(s)`);
      console.log('='.repeat(60));
      for (const r of rows) {
        console.log(`  row id=${r.id}  ${column}=${JSON.stringify(r.bad_value)}`);
      }
    } else {
      console.log(`OK : ${table}.${column}`);
    }
  } catch (e) {
    console.log(`ERR: ${table}.${column} — ${e.message.split('\n')[0]}`);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(totalBad === 0 ? 'All UUID columns are clean.' : `Found ${totalBad} bad UUID row(s) total.`);
console.log('='.repeat(60));

await prisma.$disconnect();
