// Simulates the actual chat.service.getMyRooms query against production DB
// to reproduce the P2023 error offline and trace exactly which sub-query fails.

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

const prisma = new PrismaClient({ log: ['error', 'warn'] });

// Grab a handful of real users to test as (covers buyer/seller/admin roles).
const users = await prisma.user.findMany({
  select: { id: true, phone: true, firstName: true, role: true },
});
console.log(`Testing against ${users.length} user(s):`);
for (const u of users) console.log(`  ${u.role.padEnd(15)} ${u.firstName ?? ''} ${u.phone} ${u.id}`);

async function testQuery(label, fn) {
  try {
    const res = await fn();
    console.log(`  ✓ ${label}: ${Array.isArray(res) ? `${res.length} row(s)` : 'ok'}`);
  } catch (e) {
    console.log(`  ✗ ${label}: ${e.code ?? ''} ${e.message.split('\n')[0]}`);
  }
}

for (const u of users) {
  console.log(`\n--- User ${u.phone} (${u.role}) id=${u.id} ---`);

  await testQuery('buyer offers', () =>
    prisma.sellerOffer.findMany({
      where: { demand: { buyerId: u.id } },
      select: { id: true },
    }),
  );
  await testQuery('seller offers (merchant.userId)', () =>
    prisma.sellerOffer.findMany({
      where: { stall: { merchant: { userId: u.id } } },
      select: { id: true },
    }),
  );
  await testQuery('attendant offers', () =>
    prisma.sellerOffer.findMany({
      where: { stall: { attendants: { some: { userId: u.id } } } },
      select: { id: true },
    }),
  );

  await testQuery('old nested chatRoom.findMany (OR)', () =>
    prisma.chatRoom.findMany({
      where: {
        offer: {
          OR: [
            { demand: { buyerId: u.id } },
            { stall: { merchant: { userId: u.id } } },
            { stall: { attendants: { some: { userId: u.id } } } },
          ],
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, firstName: true } } },
        },
        offer: {
          select: {
            id: true,
            totalPrice: true,
            status: true,
            demand: { select: { title: true } },
            stall: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

await prisma.$disconnect();
