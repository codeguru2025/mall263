import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getByVariant(variantId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { variantId },
      include: { variant: { include: { product: { select: { name: true, stallId: true } } } } },
    });
    if (!inventory) throw new NotFoundException('Inventory not found');
    return inventory;
  }

  async getByStall(stallId: string) {
    return this.prisma.inventory.findMany({
      where: { variant: { product: { stallId } } },
      include: {
        variant: {
          include: { product: { select: { id: true, name: true, status: true } } },
        },
      },
      orderBy: { quantity: 'asc' },
    });
  }

  async getLowStock(stallId: string) {
    return this.prisma.$queryRaw`
      SELECT i.id, i.quantity, i.low_stock_threshold, i.reserved_qty,
             pv.name as variant_name, pv.sku, p.name as product_name
      FROM inventory i
      JOIN product_variants pv ON pv.id = i.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN stalls s ON s.id = p.stall_id
      WHERE s.id = ${stallId}::uuid
        AND i.quantity <= i.low_stock_threshold
      ORDER BY i.quantity ASC
    `;
  }

  async adjustStock(variantId: string, changeQty: number, reason: string, performedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({ where: { variantId } });
      if (!inventory) throw new NotFoundException('Inventory not found');

      const newQty = inventory.quantity + changeQty;
      if (newQty < 0) throw new BadRequestException('Stock cannot go below zero');

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: newQty,
          lastRestockedAt: changeQty > 0 ? new Date() : undefined,
        },
      });

      await tx.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          changeQty,
          previousQty: inventory.quantity,
          newQty,
          reason,
          performedBy,
        },
      });

      return { variantId, previousQty: inventory.quantity, newQty, changeQty };
    });
  }

  async bulkAdjust(adjustments: Array<{ variantId: string; quantity: number }>, performedBy: string) {
    const results = [];
    for (const adj of adjustments) {
      const result = await this.adjustStock(adj.variantId, adj.quantity, 'BULK_ADJUST', performedBy);
      results.push(result);
    }
    return results;
  }

  async setLowStockThreshold(variantId: string, threshold: number) {
    const inventory = await this.prisma.inventory.findUnique({ where: { variantId } });
    if (!inventory) throw new NotFoundException('Inventory not found');
    return this.prisma.inventory.update({
      where: { id: inventory.id },
      data: { lowStockThreshold: threshold },
    });
  }

  async getInventoryLogs(variantId: string, page = 1, limit = 20) {
    const inventory = await this.prisma.inventory.findUnique({ where: { variantId } });
    if (!inventory) throw new NotFoundException('Inventory not found');

    const [data, total] = await Promise.all([
      this.prisma.inventoryLog.findMany({
        where: { inventoryId: inventory.id },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryLog.count({ where: { inventoryId: inventory.id } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
