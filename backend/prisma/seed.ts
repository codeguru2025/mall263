import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Mall263 database...');

  // Create Super Admin
  const adminPassword = await bcrypt.hash('admin123456', 10);
  const admin = await prisma.user.upsert({
    where: { phone: '+263770000001' },
    update: {},
    create: {
      phone: '+263770000001',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('Created admin:', admin.id);

  // Create admin wallet
  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, availableBalance: 0, lockedBalance: 0, currency: 'USD' },
  });

  // Create a sample merchant user
  const merchantPassword = await bcrypt.hash('merchant123', 10);
  const merchantUser = await prisma.user.upsert({
    where: { phone: '+263771000001' },
    update: {},
    create: {
      phone: '+263771000001',
      passwordHash: merchantPassword,
      firstName: 'Jane',
      lastName: 'Moyo',
      role: 'STALL_OWNER',
      status: 'ACTIVE',
    },
  });

  await prisma.wallet.upsert({
    where: { userId: merchantUser.id },
    update: {},
    create: { userId: merchantUser.id, availableBalance: 500, lockedBalance: 0, currency: 'USD' },
  });

  // Create merchant
  const merchant = await prisma.merchant.upsert({
    where: { userId: merchantUser.id },
    update: {},
    create: {
      userId: merchantUser.id,
      businessName: 'Jane\'s Fashion Hub',
      status: 'VERIFIED',
    },
  });

  // Create a mall
  const mall = await prisma.mall.upsert({
    where: { id: 'seed-mall-1' },
    update: {},
    create: {
      id: 'seed-mall-1',
      name: 'Mbare Musika Market',
      city: 'Harare',
      address: 'Mbare, Harare',
      latitude: -17.8419,
      longitude: 31.0678,
    },
  });

  // Create a stall
  const stall = await prisma.stall.upsert({
    where: { id: 'seed-stall-1' },
    update: {},
    create: {
      id: 'seed-stall-1',
      merchantId: merchant.id,
      mallId: mall.id,
      name: 'Jane\'s Corner Stall A1',
      stallNumber: 'A1',
      status: 'ACTIVE',
    },
  });

  // Create sample products
  const product1 = await prisma.product.upsert({
    where: { id: 'seed-product-1' },
    update: {},
    create: {
      id: 'seed-product-1',
      stallId: stall.id,
      name: 'Men\'s Casual Sneakers',
      slug: 'mens-casual-sneakers',
      description: 'Comfortable everyday sneakers, available in multiple colors.',
      minPrice: 28.00,
      maxPrice: 28.00,
      status: 'ACTIVE',
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'seed-variant-1' },
    update: {},
    create: {
      id: 'seed-variant-1',
      productId: product1.id,
      name: 'Black Size 42',
      sku: 'SNK-BLK-42',
      color: 'Black',
      size: '42',
      costPrice: 15.00,
      sellingPrice: 28.00,
    },
  });

  await prisma.inventory.upsert({
    where: { variantId: 'seed-variant-1' },
    update: {},
    create: {
      variantId: 'seed-variant-1',
      quantity: 25,
      lowStockThreshold: 5,
    },
  });

  const product2 = await prisma.product.upsert({
    where: { id: 'seed-product-2' },
    update: {},
    create: {
      id: 'seed-product-2',
      stallId: stall.id,
      name: 'Women\'s Ankara Dress',
      slug: 'womens-ankara-dress',
      description: 'Beautiful African print dress, handmade with quality fabric.',
      minPrice: 25.00,
      maxPrice: 25.00,
      status: 'ACTIVE',
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'seed-variant-2' },
    update: {},
    create: {
      id: 'seed-variant-2',
      productId: product2.id,
      name: 'Red Size M',
      sku: 'ANK-RED-M',
      color: 'Red',
      size: 'M',
      costPrice: 12.00,
      sellingPrice: 25.00,
    },
  });

  await prisma.inventory.upsert({
    where: { variantId: 'seed-variant-2' },
    update: {},
    create: {
      variantId: 'seed-variant-2',
      quantity: 15,
      lowStockThreshold: 3,
    },
  });

  // Create a buyer user
  const buyerPassword = await bcrypt.hash('buyer12345', 10);
  const buyer = await prisma.user.upsert({
    where: { phone: '+263772000001' },
    update: {},
    create: {
      phone: '+263772000001',
      passwordHash: buyerPassword,
      firstName: 'Tafadzwa',
      lastName: 'Chirwa',
      role: 'BUYER',
      status: 'ACTIVE',
    },
  });

  await prisma.wallet.upsert({
    where: { userId: buyer.id },
    update: {},
    create: { userId: buyer.id, availableBalance: 100, lockedBalance: 10, currency: 'USD' },
  });

  // Create a field agent
  const agentPassword = await bcrypt.hash('agent12345', 10);
  const agent = await prisma.user.upsert({
    where: { phone: '+263773000001' },
    update: {},
    create: {
      phone: '+263773000001',
      passwordHash: agentPassword,
      firstName: 'Blessing',
      lastName: 'Ndlovu',
      role: 'FIELD_AGENT',
      status: 'ACTIVE',
    },
  });

  await prisma.wallet.upsert({
    where: { userId: agent.id },
    update: {},
    create: { userId: agent.id, availableBalance: 0, lockedBalance: 0, currency: 'USD' },
  });

  console.log('Seed completed successfully!');
  console.log('---');
  console.log('Test accounts:');
  console.log('  Admin:    +263770000001 / admin123456');
  console.log('  Merchant: +263771000001 / merchant123');
  console.log('  Buyer:    +263772000001 / buyer12345');
  console.log('  Agent:    +263773000001 / agent12345');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
