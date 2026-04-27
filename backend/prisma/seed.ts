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

  // Default categories — idempotent upsert by slug
  const defaultCategories = [
    { name: 'Fashion & Clothing', slug: 'fashion-clothing', sortOrder: 1 },
    { name: 'Beauty & Health', slug: 'beauty-health', sortOrder: 2 },
    { name: 'Electronics', slug: 'electronics', sortOrder: 3 },
    { name: 'Food & Groceries', slug: 'food-groceries', sortOrder: 4 },
    { name: 'Home & Living', slug: 'home-living', sortOrder: 5 },
    { name: 'Sports & Fitness', slug: 'sports-fitness', sortOrder: 6 },
    { name: 'Agriculture', slug: 'agriculture', sortOrder: 7 },
    { name: 'Services', slug: 'services', sortOrder: 8 },
  ];
  for (const cat of defaultCategories) {
    // Match on either name or slug — whichever already exists in the DB
    const existing = await prisma.category.findFirst({
      where: { OR: [{ name: cat.name }, { slug: cat.slug }] },
    });
    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { sortOrder: cat.sortOrder, isActive: true },
      });
    } else {
      await prisma.category.create({
        data: { name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder, isActive: true },
      });
    }
  }
  console.log('Default categories seeded:', defaultCategories.map((c) => c.name).join(', '));

  console.log('Seed completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
