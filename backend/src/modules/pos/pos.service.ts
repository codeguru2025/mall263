import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { InventoryService } from '../inventory/inventory.service';
import { POSSaleStatus, PaymentMethod, Prisma, WalletTransactionType, WalletTransactionStatus } from '@prisma/client';

interface CartItem {
  variantId: string;
  quantity: number;
  discount?: number;
}

@Injectable()
export class POSService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private inventoryService: InventoryService,
  ) {}

  /**
   * Process a POS sale with full commission enforcement and inventory deduction.
   *
   * ACID guarantees:
   * - ATOMICITY: All operations (inventory deduction, sale creation, commission charge)
   *   are in one Serializable transaction. All succeed or all roll back.
   * - CONSISTENCY: Commission balance is re-checked inside the transaction after
   *   the outer read, catching race conditions between check and deduction.
   * - ISOLATION: Serializable isolation prevents phantom reads on inventory and wallet.
   * - RECEIPT NUMBER: Generated inside the transaction to prevent concurrent sales
   *   on the same stall from producing duplicate receipt numbers.
   */
  async processSale(data: {
    stallId: string;
    cashierId: string;
    items: CartItem[];
    paymentMethod: PaymentMethod;
    discountAmount?: number;
    discountType?: string;
    customerPhone?: string;
    notes?: string;
  }) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    return this.prisma.$retryTransaction(
      async (tx) => {
        // 1. Get stall and merchant info
        const stall = await tx.stall.findUnique({
          where: { id: data.stallId },
          include: { merchant: { include: { user: true } } },
        });
        if (!stall) throw new NotFoundException('Stall not found');

        // 2. Validate and calculate cart items
        let subtotal = new Prisma.Decimal(0);
        let totalCost = new Prisma.Decimal(0);
        const saleItems: Array<{
          variantId: string;
          productName: string;
          variantName: string;
          quantity: number;
          unitPrice: Prisma.Decimal;
          costPrice: Prisma.Decimal;
          discount: Prisma.Decimal;
          totalPrice: Prisma.Decimal;
        }> = [];

        for (const item of data.items) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: { inventory: true, product: { select: { name: true, stallId: true } } },
          });

          if (!variant) throw new BadRequestException(`Variant ${item.variantId} not found`);
          if (variant.product.stallId !== data.stallId) {
            throw new BadRequestException(`Product does not belong to this stall`);
          }
          if (!variant.inventory) throw new BadRequestException(`No inventory record for variant ${variant.name}`);

          // Race condition protection: check available stock
          const availableStock = variant.inventory.quantity - variant.inventory.reservedQty;
          if (availableStock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for "${variant.product.name} - ${variant.name}". Available: ${availableStock}, Requested: ${item.quantity}`,
            );
          }

          const itemDiscount = new Prisma.Decimal(item.discount || 0);
          const unitPrice = variant.sellingPrice;
          const lineTotal = unitPrice.mul(item.quantity).sub(itemDiscount);

          subtotal = subtotal.add(lineTotal);
          totalCost = totalCost.add(variant.costPrice.mul(item.quantity));

          saleItems.push({
            variantId: item.variantId,
            productName: variant.product.name,
            variantName: variant.name,
            quantity: item.quantity,
            unitPrice,
            costPrice: variant.costPrice,
            discount: itemDiscount,
            totalPrice: lineTotal,
          });

          // 3. Deduct inventory immediately within transaction
          await tx.inventory.update({
            where: { id: variant.inventory.id },
            data: { quantity: { decrement: item.quantity } },
          });

          // Log inventory change
          await tx.inventoryLog.create({
            data: {
              inventoryId: variant.inventory.id,
              changeQty: -item.quantity,
              previousQty: variant.inventory.quantity,
              newQty: variant.inventory.quantity - item.quantity,
              reason: 'POS_SALE',
              performedBy: data.cashierId,
            },
          });
        }

        // 4. Calculate totals
        const saleDiscount = new Prisma.Decimal(data.discountAmount || 0);
        const totalAmount = subtotal.sub(saleDiscount);
        const commissionRate = new Prisma.Decimal(0.025);
        const commissionAmount = totalAmount.mul(commissionRate);

        // 5. CRITICAL: Check seller commission balance inside the transaction
        const sellerUserId = stall.merchant.userId;
        const sellerWallet = await tx.wallet.findUnique({ where: { userId: sellerUserId } });
        if (!sellerWallet) throw new NotFoundException('Seller wallet not found');

        const sellerAvailable = parseFloat(sellerWallet.availableBalance.toString());
        const commissionDeduct = parseFloat(commissionAmount.toString());

        if (sellerAvailable < commissionDeduct) {
          throw new BadRequestException(
            `Sale blocked: Insufficient commission balance. ` +
            `Sale of $${totalAmount.toFixed(2)} requires $${commissionDeduct.toFixed(2)} commission. ` +
            `Available: $${sellerAvailable.toFixed(2)}. ` +
            `Please fund your wallet before processing sales.`,
          );
        }

        // 6. Generate receipt number INSIDE the transaction to prevent duplicates
        //    under concurrent sales for the same stall on the same day.
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const todayCount = await tx.pOSSale.count({
          where: {
            stallId: data.stallId,
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        });
        const receiptNumber = `M263-${today}-${(todayCount + 1).toString().padStart(4, '0')}`;

        // 7. Create the sale record
        const sale = await tx.pOSSale.create({
          data: {
            stallId: data.stallId,
            cashierId: data.cashierId,
            receiptNumber,
            subtotal,
            discountAmount: saleDiscount,
            discountType: data.discountType,
            taxAmount: 0,
            totalAmount,
            commissionAmount,
            commissionRate,
            currency: 'USD',
            paymentMethod: data.paymentMethod,
            status: POSSaleStatus.COMPLETED,
            customerPhone: data.customerPhone,
            notes: data.notes,
            items: {
              create: saleItems,
            },
            receipt: {
              create: {
                data: {
                  stallName: stall.name,
                  stallNumber: stall.stallNumber,
                  items: saleItems.map(i => ({
                    name: `${i.productName} - ${i.variantName}`,
                    qty: i.quantity,
                    price: i.unitPrice.toString(),
                    total: i.totalPrice.toString(),
                  })),
                  subtotal: subtotal.toString(),
                  discount: saleDiscount.toString(),
                  total: totalAmount.toString(),
                  paymentMethod: data.paymentMethod,
                  cashier: data.cashierId,
                  date: new Date().toISOString(),
                },
                sentTo: data.customerPhone,
              },
            },
          },
          include: { items: true, receipt: true },
        });

        // 8. Deduct commission from seller wallet atomically inside this transaction
        const sellerNewBalance = new Prisma.Decimal(sellerAvailable - commissionDeduct);
        await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: { availableBalance: sellerNewBalance, lastActivityAt: new Date() },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: sellerWallet.id,
            type: WalletTransactionType.COMMISSION_DEDUCTION,
            amount: commissionAmount,
            balanceBefore: sellerWallet.availableBalance,
            balanceAfter: sellerNewBalance,
            status: WalletTransactionStatus.COMPLETED,
            description: `Commission for sale ${sale.id} (2.5% of $${totalAmount.toFixed(2)})`,
            referenceId: sale.id,
            referenceType: 'pos_sale',
            completedAt: new Date(),
          },
        });

        return {
          sale,
          profit: parseFloat(totalAmount.toString()) - parseFloat(totalCost.toString()) - commissionDeduct,
          commission: commissionDeduct,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Get sale by ID with all details.
   */
  async getSaleById(saleId: string) {
    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        receipt: true,
        stall: { select: { name: true, stallNumber: true } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  /**
   * Get sales for a stall with date filtering.
   */
  async getSalesByStall(stallId: string, params: {
    startDate?: Date;
    endDate?: Date;
    status?: POSSaleStatus;
    page?: number;
    limit?: number;
  }) {
    const { startDate, endDate, status, page = 1, limit = 20 } = params;
    const where: any = { stallId };
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.pOSSale.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pOSSale.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Daily sales summary for a stall.
   */
  async getDailySummary(stallId: string, date?: Date) {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await this.prisma.pOSSale.findMany({
      where: {
        stallId,
        status: POSSaleStatus.COMPLETED,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      include: { items: true },
    });

    const totalRevenue = sales.reduce((sum: number, s: any) => sum + parseFloat(s.totalAmount.toString()), 0);
    const totalCost = sales.reduce(
      (sum: number, s: any) => sum + s.items.reduce((iSum: number, i: any) => iSum + parseFloat(i.costPrice.toString()) * i.quantity, 0),
      0,
    );
    const totalCommission = sales.reduce((sum: number, s: any) => sum + parseFloat(s.commissionAmount.toString()), 0);
    const totalDiscount = sales.reduce((sum: number, s: any) => sum + parseFloat(s.discountAmount.toString()), 0);

    return {
      date: targetDate.toISOString().split('T')[0],
      salesCount: sales.length,
      totalRevenue,
      totalCost,
      grossProfit: totalRevenue - totalCost,
      netProfit: totalRevenue - totalCost - totalCommission,
      totalCommission,
      totalDiscount,
      itemsSold: sales.reduce((sum: number, s: any) => sum + s.items.reduce((iSum: number, i: any) => iSum + i.quantity, 0), 0),
      averageOrderValue: sales.length > 0 ? totalRevenue / sales.length : 0,
      paymentBreakdown: this.getPaymentBreakdown(sales),
    };
  }

  /**
   * Process a refund.
   *
   * ACID FIX: Previously this only restored inventory but never refunded the seller
   * commission — leaving the seller permanently short-charged on every refund.
   * Now the commission is credited back to the seller's wallet atomically in the
   * same transaction as the inventory restore and sale status update.
   */
  async processRefund(saleId: string, reason: string, processedBy: string) {
    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        stall: { include: { merchant: { include: { user: true } } } },
      },
    });

    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status === POSSaleStatus.FULLY_REFUNDED) {
      throw new BadRequestException('Sale already fully refunded');
    }

    return this.prisma.$retryTransaction(
      async (tx) => {
        // 1. Restore inventory
        for (const item of sale.items) {
          const inventory = await tx.inventory.findUnique({
            where: { variantId: item.variantId },
          });
          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantity: { increment: item.quantity } },
            });
            await tx.inventoryLog.create({
              data: {
                inventoryId: inventory.id,
                changeQty: item.quantity,
                previousQty: inventory.quantity,
                newQty: inventory.quantity + item.quantity,
                reason: 'REFUND',
                referenceId: saleId,
                referenceType: 'pos_sale',
                performedBy: processedBy,
              },
            });
          }
        }

        // 2. Refund commission back to seller wallet (atomic with inventory restore)
        const sellerUserId = sale.stall.merchant.userId;
        const sellerWallet = await tx.wallet.findUnique({ where: { userId: sellerUserId } });
        if (sellerWallet) {
          const commissionAmount = parseFloat(sale.commissionAmount.toString());
          const refundedBalance = new Prisma.Decimal(
            parseFloat(sellerWallet.availableBalance.toString()) + commissionAmount,
          );

          await tx.wallet.update({
            where: { id: sellerWallet.id },
            data: { availableBalance: refundedBalance, lastActivityAt: new Date() },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: sellerWallet.id,
              type: WalletTransactionType.REFUND_CREDIT,
              amount: sale.commissionAmount,
              balanceBefore: sellerWallet.availableBalance,
              balanceAfter: refundedBalance,
              status: WalletTransactionStatus.COMPLETED,
              description: `Commission refund for refunded sale ${saleId}`,
              referenceId: saleId,
              referenceType: 'pos_sale',
              completedAt: new Date(),
            },
          });
        }

        // 3. Create refund record
        const refund = await tx.refund.create({
          data: {
            saleId,
            amount: sale.totalAmount,
            reason,
            status: 'PROCESSED',
            processedBy,
            processedAt: new Date(),
          },
        });

        // 4. Update sale status
        await tx.pOSSale.update({
          where: { id: saleId },
          data: { status: POSSaleStatus.FULLY_REFUNDED },
        });

        return refund;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private getPaymentBreakdown(sales: any[]) {
    const breakdown: Record<string, { count: number; total: number }> = {};
    for (const sale of sales) {
      const method = sale.paymentMethod;
      if (!breakdown[method]) breakdown[method] = { count: 0, total: 0 };
      breakdown[method].count++;
      breakdown[method].total += parseFloat(sale.totalAmount.toString());
    }
    return breakdown;
  }
}
