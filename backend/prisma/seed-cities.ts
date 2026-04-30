import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ZIMBABWE_CITIES: { name: string; province: string }[] = [
  // Harare Province
  { name: 'Harare',        province: 'Harare' },
  { name: 'Chitungwiza',   province: 'Harare' },
  { name: 'Ruwa',          province: 'Harare' },
  { name: 'Epworth',       province: 'Harare' },

  // Bulawayo Province
  { name: 'Bulawayo',      province: 'Bulawayo' },

  // Manicaland
  { name: 'Mutare',        province: 'Manicaland' },
  { name: 'Rusape',        province: 'Manicaland' },
  { name: 'Chipinge',      province: 'Manicaland' },
  { name: 'Chimanimani',   province: 'Manicaland' },
  { name: 'Nyanga',        province: 'Manicaland' },
  { name: 'Juliasdale',    province: 'Manicaland' },
  { name: 'Headlands',     province: 'Manicaland' },
  { name: 'Cashel',        province: 'Manicaland' },

  // Mashonaland Central
  { name: 'Bindura',       province: 'Mashonaland Central' },
  { name: 'Mvurwi',        province: 'Mashonaland Central' },
  { name: 'Centenary',     province: 'Mashonaland Central' },
  { name: 'Mt Darwin',     province: 'Mashonaland Central' },
  { name: 'Shamva',        province: 'Mashonaland Central' },
  { name: 'Guruve',        province: 'Mashonaland Central' },

  // Mashonaland East
  { name: 'Marondera',     province: 'Mashonaland East' },
  { name: 'Mutoko',        province: 'Mashonaland East' },
  { name: 'Chivhu',        province: 'Mashonaland East' },
  { name: 'Murewa',        province: 'Mashonaland East' },
  { name: 'Wedza',         province: 'Mashonaland East' },

  // Mashonaland West
  { name: 'Chinhoyi',      province: 'Mashonaland West' },
  { name: 'Kadoma',        province: 'Mashonaland West' },
  { name: 'Norton',        province: 'Mashonaland West' },
  { name: 'Chegutu',       province: 'Mashonaland West' },
  { name: 'Kariba',        province: 'Mashonaland West' },
  { name: 'Karoi',         province: 'Mashonaland West' },
  { name: 'Murombedzi',    province: 'Mashonaland West' },
  { name: 'Banket',        province: 'Mashonaland West' },

  // Masvingo
  { name: 'Masvingo',      province: 'Masvingo' },
  { name: 'Chiredzi',      province: 'Masvingo' },
  { name: 'Gutu',          province: 'Masvingo' },
  { name: 'Bikita',        province: 'Masvingo' },
  { name: 'Zaka',          province: 'Masvingo' },

  // Matabeleland North
  { name: 'Victoria Falls', province: 'Matabeleland North' },
  { name: 'Hwange',        province: 'Matabeleland North' },
  { name: 'Lupane',        province: 'Matabeleland North' },
  { name: 'Binga',         province: 'Matabeleland North' },
  { name: 'Nkayi',         province: 'Matabeleland North' },
  { name: 'Inyati',        province: 'Matabeleland North' },
  { name: 'Tsholotsho',    province: 'Matabeleland North' },
  { name: 'Dete',          province: 'Matabeleland North' },

  // Matabeleland South
  { name: 'Gwanda',        province: 'Matabeleland South' },
  { name: 'Beitbridge',    province: 'Matabeleland South' },
  { name: 'Plumtree',      province: 'Matabeleland South' },
  { name: 'Filabusi',      province: 'Matabeleland South' },
  { name: 'Esigodini',     province: 'Matabeleland South' },
  { name: 'Kezi',          province: 'Matabeleland South' },

  // Midlands
  { name: 'Gweru',         province: 'Midlands' },
  { name: 'Kwekwe',        province: 'Midlands' },
  { name: 'Zvishavane',    province: 'Midlands' },
  { name: 'Redcliff',      province: 'Midlands' },
  { name: 'Shurugwi',      province: 'Midlands' },
  { name: 'Gokwe',         province: 'Midlands' },
  { name: 'Mberengwa',     province: 'Midlands' },
  { name: 'Mvuma',         province: 'Midlands' },
  { name: 'Lalapanzi',     province: 'Midlands' },
  { name: 'Shangani',      province: 'Midlands' },
];

async function main() {
  console.log('Seeding Zimbabwe cities and major towns...');

  let created = 0;
  let updated = 0;

  for (const { name, province } of ZIMBABWE_CITIES) {
    const existing = await prisma.city.findUnique({ where: { name } });
    if (existing) {
      await prisma.city.update({ where: { name }, data: { province, country: 'ZW', isActive: true } });
      updated++;
    } else {
      await prisma.city.create({ data: { name, country: 'ZW', province, isActive: true } });
      created++;
    }
  }

  console.log(`Done. Created: ${created}, updated: ${updated}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
