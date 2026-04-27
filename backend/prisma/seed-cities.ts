import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ZIMBABWE_CITIES = [
  'Harare',
  'Bulawayo',
  'Chitungwiza',
  'Mutare',
  'Gweru',
  'Kwekwe',
  'Kadoma',
  'Masvingo',
  'Chinhoyi',
  'Norton',
  'Marondera',
  'Ruwa',
  'Chegutu',
  'Zvishavane',
  'Bindura',
  'Beitbridge',
  'Redcliff',
  'Victoria Falls',
  'Hwange',
  'Rusape',
  'Kariba',
  'Karoi',
  'Chiredzi',
  'Gokwe',
  'Shurugwi',
  'Lupane',
  'Gwanda',
  'Plumtree',
  'Chipinge',
  'Mutoko',
  'Mvurwi',
  'Gutu',
  'Mberengwa',
  'Nkayi',
  'Binga',
  'Centenary',
  'Headlands',
  'Murombedzi',
  'Mvuma',
  'Chivhu',
  'Nyanga',
  'Juliasdale',
  'Chimanimani',
  'Cashel',
  'Filabusi',
  'Esigodini',
  'Inyati',
  'Nkayi',
  'Tsholotsho',
  'Dete',
];

async function main() {
  console.log('Seeding Zimbabwe cities...');

  const unique = [...new Set(ZIMBABWE_CITIES)];
  let created = 0;
  let skipped = 0;

  for (const name of unique) {
    const result = await prisma.city.upsert({
      where: { name },
      update: {},
      create: { name, country: 'ZW' },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`Done. Created: ${created}, already existed: ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
