import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Mall263 database...');

  // Create owner superuser — credentials come from environment variables only
  const ownerPassword = process.env.SUPERADMIN_PASSWORD;
  const ownerPhone    = process.env.SUPERADMIN_PHONE;
  const ownerFirst    = process.env.SUPERADMIN_FIRST_NAME || 'Super';
  const ownerLast     = process.env.SUPERADMIN_LAST_NAME  || 'Admin';

  if (!ownerPassword) throw new Error('SUPERADMIN_PASSWORD env var is required');
  if (!ownerPhone)    throw new Error('SUPERADMIN_PHONE env var is required');

  const ownerHash = await bcrypt.hash(ownerPassword, 12);

  const owner = await prisma.user.upsert({
    where: { phone: ownerPhone },
    update: { passwordHash: ownerHash, role: 'SUPER_ADMIN', status: 'ACTIVE' },
    create: {
      phone: ownerPhone,
      passwordHash: ownerHash,
      firstName: ownerFirst,
      lastName:  ownerLast,
      role:   'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('Superadmin created:', owner.id);

  await prisma.wallet.upsert({
    where:  { userId: owner.id },
    update: {},
    create: { userId: owner.id, availableBalance: 0, lockedBalance: 0, currency: 'USD' },
  });

  // Feature flags — all disabled by default; enable via admin panel or direct DB update
  const featureFlags = [
    'ENABLE_DELIVERY_LAYER',
    'ENABLE_SAFE_PAY_ESCROW',
    'ENABLE_CASH_ON_DELIVERY',
    'ENABLE_DRIVER_FLOAT',
    'ENABLE_DISPUTE_SYSTEM',
  ];
  for (const key of featureFlags) {
    await prisma.appSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: 'false' },
    });
  }
  console.log('Feature flags seeded:', featureFlags.join(', '));

  // Delivery radius (km) — default 10 km
  await prisma.appSetting.upsert({
    where: { key: 'DELIVERY_RADIUS_KM' },
    update: {},
    create: { key: 'DELIVERY_RADIUS_KM', value: '10' },
  });
  console.log('Delivery radius setting seeded: DELIVERY_RADIUS_KM = 10');

  console.log('Seed completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
