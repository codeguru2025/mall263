// Full end-to-end repro of the chat request flow for a specific user,
// including every Prisma call that runs for that request.

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

const USER_PHONE = '+263773665350';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

let errorCount = 0;
prisma.$on('error', (e) => {
  errorCount++;
  console.log(`\n!! Prisma error event:`, e);
});

async function step(label, fn) {
  process.stdout.write(`\n▶ ${label}... `);
  try {
    const t0 = Date.now();
    const result = await fn();
    console.log(`OK (${Date.now() - t0}ms)`);
    return result;
  } catch (err) {
    const e = err;
    console.log(`✗ FAILED`);
    console.log(`   code   : ${e.code ?? '(none)'}`);
    console.log(`   message: ${e.message?.split('\n').slice(0, 8).join('\n            ')}`);
    if (e.meta) console.log(`   meta   : ${JSON.stringify(e.meta)}`);
    return null;
  }
}

const user = await step('find user by phone', () =>
  prisma.user.findFirst({ where: { phone: USER_PHONE } }),
);
if (!user) { console.log('no such user'); process.exit(1); }
console.log(`  user.id = ${user.id}  role=${user.role}`);

const userId = user.id;

// Mimic JwtStrategy.validate
await step('JwtStrategy.validate (findUnique)', () =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, firstName: true, lastName: true, avatarUrl: true, role: true, status: true },
  }),
);

// Mimic new getMyRooms — 3 role lookups
const buyerOffers = await step('sellerOffer.findMany (buyer)', () =>
  prisma.sellerOffer.findMany({ where: { demand: { buyerId: userId } }, select: { id: true } }),
);
const sellerOffers = await step('sellerOffer.findMany (merchant)', () =>
  prisma.sellerOffer.findMany({ where: { stall: { merchant: { userId } } }, select: { id: true } }),
);
const attendantOffers = await step('sellerOffer.findMany (attendant)', () =>
  prisma.sellerOffer.findMany({ where: { stall: { attendants: { some: { userId } } } }, select: { id: true } }),
);

const offerIds = Array.from(new Set([...(buyerOffers ?? []), ...(sellerOffers ?? []), ...(attendantOffers ?? [])].map(o => o.id)));
console.log(`\n offerIds = ${offerIds.length ? offerIds.join(', ') : '(none)'}`);

if (offerIds.length) {
  await step('chatRoom.findMany (rich include)', () =>
    prisma.chatRoom.findMany({
      where: { offerId: { in: offerIds } },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, firstName: true } } },
        },
        offer: {
          select: {
            id: true, totalPrice: true, status: true,
            demand: { select: { title: true } },
            stall: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  );

  await step('chatRoom.findMany (minimal, no include)', () =>
    prisma.chatRoom.findMany({
      where: { offerId: { in: offerIds } },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

// Also try the OLD nested OR query that was deployed before our first fix
await step('chatRoom.findMany (OLD nested OR)', () =>
  prisma.chatRoom.findMany({
    where: {
      offer: {
        OR: [
          { demand: { buyerId: userId } },
          { stall: { merchant: { userId } } },
          { stall: { attendants: { some: { userId } } } },
        ],
      },
    },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, firstName: true } } } },
      offer: { select: { id: true, totalPrice: true, status: true, demand: { select: { title: true } }, stall: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  }),
);

console.log(`\nDone. errorCount=${errorCount}`);

await prisma.$disconnect();
