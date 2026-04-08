import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Mall263 database...');

  // Create owner superuser — credentials come from environment variables only
  const ownerPassword = process.env.SUPERADMIN_PASSWORD;
  const ownerPhone    = process.env.SUPERADMIN_PHONE;
  const ownerEmail    = process.env.SUPERADMIN_EMAIL;
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
      ...(ownerEmail ? { email: ownerEmail } : {}),
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

  console.log('Seed completed.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
