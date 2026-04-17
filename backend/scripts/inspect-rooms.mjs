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

const rooms = await prisma.$queryRawUnsafe(`SELECT id, offer_id, created_at FROM chat_rooms`);
console.log('Rooms:', rooms);

for (const r of rooms) {
  console.log(`\n=== Room ${r.id} (offer ${r.offer_id}) ===`);

  const offer = await prisma.$queryRawUnsafe(
    `SELECT id, demand_id, stall_id, status, total_price::text AS total_price, currency FROM seller_offers WHERE id = $1`,
    r.offer_id,
  );
  console.log('  offer:', offer);

  if (offer.length) {
    const o = offer[0];
    const demand = await prisma.$queryRawUnsafe(
      `SELECT id, buyer_id, title FROM buyer_demands WHERE id = $1`,
      o.demand_id,
    );
    console.log('  demand:', demand);

    const stall = await prisma.$queryRawUnsafe(
      `SELECT id, merchant_id, name FROM stalls WHERE id = $1`,
      o.stall_id,
    );
    console.log('  stall:', stall);

    if (stall.length) {
      const merchant = await prisma.$queryRawUnsafe(
        `SELECT id, user_id, business_name FROM merchants WHERE id = $1`,
        stall[0].merchant_id,
      );
      console.log('  merchant:', merchant);
    }
  }

  const msgs = await prisma.$queryRawUnsafe(
    `SELECT id, sender_id, content, created_at FROM chat_messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT 3`,
    r.id,
  );
  console.log('  last messages:', msgs);

  for (const m of msgs) {
    const sender = await prisma.$queryRawUnsafe(
      `SELECT id, first_name, last_name FROM users WHERE id = $1`,
      m.sender_id,
    );
    console.log(`    sender(${m.sender_id}):`, sender);
  }
}

await prisma.$disconnect();
