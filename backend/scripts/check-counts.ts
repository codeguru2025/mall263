import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
Promise.all([
  p.mall.count(),
  p.category.count(),
  p.ad.count(),
  p.stall.count(),
  p.product.count(),
]).then(([malls, categories, ads, stalls, products]) => {
  console.log(JSON.stringify({ malls, categories, ads, stalls, products }, null, 2));
}).finally(() => p.$disconnect());
