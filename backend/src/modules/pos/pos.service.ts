import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { resolveStoreLogo } from '../../common/utils/store-branding';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { InventoryService } from '../inventory/inventory.service';
import { RedisService } from '../../redis/redis.service';
import { POSSaleStatus, PaymentMethod, Prisma, WalletTransactionType, WalletTransactionStatus, NotificationType, DiscountType, DiscountReason } from '@prisma/client';

interface CartItem {
  variantId: string;
  quantity: number;
  discount?: number;
}

interface PendingMerchantPayment {
  stallId: string;
  cashierId: string;
  items: CartItem[];
  paymentMethod: 'ECOCASH' | 'ONEMONEY';
  discountAmount?: number;
  discountType?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  amount: number;
  notes?: string;
}

@Injectable()
export class POSService {
  private readonly logger = new Logger(POSService.name);

  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private inventoryService: InventoryService,
    private redis: RedisService,
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
    discountType?: DiscountType;
    discountReason?: DiscountReason;
    discountCode?: string;
    discountId?: string;
    customerPhone?: string;
    notes?: string;
    deliveryAddress?: string;
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

          // Low stock notification: trigger if new quantity is at or below threshold
          const newQty = variant.inventory.quantity - item.quantity;
          const threshold = variant.inventory.lowStockThreshold ?? 5;
          if (newQty <= threshold && newQty > 0) {
            await tx.notification.create({
              data: {
                userId: stall.merchant.userId,
                type: NotificationType.LOW_STOCK,
                title: `Low Stock: ${variant.product.name}`,
                body: `${variant.name} has only ${newQty} unit${newQty !== 1 ? 's' : ''} left. Restock soon.`,
                data: { variantId: item.variantId, productName: variant.product.name, quantity: newQty, stallId: data.stallId },
              },
            });
          } else if (newQty === 0) {
            await tx.notification.create({
              data: {
                userId: stall.merchant.userId,
                type: NotificationType.LOW_STOCK,
                title: `Out of Stock: ${variant.product.name}`,
                body: `${variant.name} is now out of stock. Add more inventory to keep selling.`,
                data: { variantId: item.variantId, productName: variant.product.name, quantity: 0, stallId: data.stallId },
              },
            });
          }
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

        if (sellerWallet.availableBalance.lessThan(commissionAmount)) {
          throw new BadRequestException(
            `Sale blocked: Insufficient commission balance. ` +
            `Sale of $${totalAmount.toFixed(2)} requires $${commissionAmount.toFixed(2)} commission. ` +
            `Available: $${sellerWallet.availableBalance.toFixed(2)}. ` +
            `Please fund your wallet before processing sales.`,
          );
        }

        // 6. Generate receipt number INSIDE the transaction to prevent duplicates
        //    under concurrent sales for the same stall on the same day.
        //    Use UTC consistently for both the date prefix and the count query
        //    to avoid timezone-boundary collisions.
        const now = new Date();
        const yyyy = now.getUTCFullYear();
        const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(now.getUTCDate()).padStart(2, '0');
        const today = `${yyyy}${mm}${dd}`;
        const startOfDayUTC = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate()));
        const todayCount = await tx.pOSSale.count({
          where: {
            stallId: data.stallId,
            createdAt: { gte: startOfDayUTC },
          },
        });
        const receiptNumber = `M263-${today}-${(todayCount + 1).toString().padStart(4, '0')}`;

        // 7. Create the sale record with enhanced discount tracking
        const sale = await tx.pOSSale.create({
          data: {
            stallId: data.stallId,
            cashierId: data.cashierId,
            receiptNumber,
            subtotal,
            discountAmount: saleDiscount,
            discountType: data.discountType,
            discountReason: data.discountReason,
            discountCode: data.discountCode,
            discountId: data.discountId,
            taxAmount: 0,
            totalAmount,
            commissionAmount,
            commissionRate,
            currency: 'USD',
            paymentMethod: data.paymentMethod,
            status: POSSaleStatus.COMPLETED,
            customerPhone: data.customerPhone,
            notes: data.notes,
            deliveryAddress: data.deliveryAddress,
            items: {
              create: saleItems,
            },
            receipt: {
              create: {
                data: {
                  stallName: stall.name,
                  stallNumber: stall.stallNumber,
                  businessName: stall.merchant.businessName,
                  storeLogoUrl: resolveStoreLogo(stall, stall.merchant),
                  items: saleItems.map(i => ({
                    name: `${i.productName} - ${i.variantName}`,
                    qty: i.quantity,
                    price: i.unitPrice.toString(),
                    total: i.totalPrice.toString(),
                  })),
                  subtotal: subtotal.toString(),
                  discount: saleDiscount.toString(),
                  discountCode: data.discountCode,
                  discountReason: data.discountReason,
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
        const sellerNewBalance = sellerWallet.availableBalance.sub(commissionAmount);
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
          profit: totalAmount.sub(totalCost).sub(commissionAmount).toNumber(),
          commission: commissionAmount.toNumber(),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Public receipt verification — no auth required.
   * Returns a safe subset of receipt data plus an authenticity flag.
   */
  async verifyReceipt(saleId: string) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(saleId)) return { authentic: false, receipt: null };

    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: saleId },
      include: {
        items: { select: { productName: true, variantName: true, quantity: true, unitPrice: true, totalPrice: true } },
        stall: {
          select: {
            id: true,
            name: true,
            stallNumber: true,
            logoUrl: true,
            merchant: { select: { businessName: true, logoUrl: true } },
          },
        },
      },
    });

    if (!sale) return { authentic: false, receipt: null };

    return {
      authentic: true,
      receipt: {
        receiptNumber: sale.receiptNumber,
        createdAt: sale.createdAt,
        totalAmount: sale.totalAmount,
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        deliveryAddress: sale.deliveryAddress ?? null,
        items: sale.items,
        stall: sale.stall,
      },
    };
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
        stall: {
          select: {
            name: true,
            stallNumber: true,
            logoUrl: true,
            merchant: { select: { businessName: true, logoUrl: true } },
          },
        },
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
    return this.prisma.$retryTransaction(
      async (tx) => {
        // Re-read sale inside tx to prevent TOCTOU on status check
        const sale = await tx.pOSSale.findUnique({
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
          const refundedBalance = sellerWallet.availableBalance.add(sale.commissionAmount);

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

  /**
   * Stage 1 of a merchant-code payment: validate the cart and reserve it in Redis.
   *
   * The actual USSD dial happens entirely on the seller's device via the mobile app
   * (Linking.openURL). No Paynow call is made here.
   *
   * ACID: inventory is untouched until confirmMerchantPayment() succeeds.
   */
  async initiateMerchantPayment(data: {
    stallId: string;
    cashierId: string;
    items: CartItem[];
    paymentMethod: 'ECOCASH' | 'ONEMONEY';
    discountAmount?: number;
    discountType?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    notes?: string;
  }) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: data.stallId },
      select: { ecocashMerchantCode: true, onemoneyMerchantCode: true },
    });
    if (!stall) throw new NotFoundException('Stall not found');

    const merchantCode =
      data.paymentMethod === 'ECOCASH' ? stall.ecocashMerchantCode : stall.onemoneyMerchantCode;
    if (!merchantCode) {
      throw new BadRequestException(
        `No ${data.paymentMethod === 'ECOCASH' ? 'EcoCash' : 'OneMoney'} merchant code configured for this stall`,
      );
    }

    // Read-only cart valuation — no DB writes yet
    let subtotal = 0;
    for (const item of data.items) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
        select: { sellingPrice: true, product: { select: { stallId: true } } },
      });
      if (!variant) throw new BadRequestException(`Variant ${item.variantId} not found`);
      if (variant.product.stallId !== data.stallId) {
        throw new BadRequestException('Product does not belong to this stall');
      }
      subtotal += parseFloat(variant.sellingPrice.toString()) * item.quantity - (item.discount ?? 0);
    }
    const totalAmount = parseFloat(Math.max(0, subtotal - (data.discountAmount ?? 0)).toFixed(2));
    if (totalAmount < 0.01) throw new BadRequestException('Total amount is too small');

    const reference = `POS-${data.stallId.slice(0, 6)}-${Date.now()}-${randomBytes(4).toString('hex')}`;

    const pending: PendingMerchantPayment = {
      stallId: data.stallId,
      cashierId: data.cashierId,
      items: data.items,
      paymentMethod: data.paymentMethod,
      discountAmount: data.discountAmount,
      discountType: data.discountType,
      customerPhone: data.customerPhone ?? undefined,
      deliveryAddress: data.deliveryAddress,
      amount: totalAmount,
      notes: data.notes,
    };
    await this.redis
      .getClient()
      .set(`pos:merchant-pay:${reference}`, JSON.stringify(pending), 'EX', 600);

    return { reference, totalAmount, merchantCode, network: data.paymentMethod };
  }

  /**
   * Stage 2: seller confirms they have received payment from the customer.
   * Finalizes the POS sale in a single Serializable transaction (inventory +
   * commission + receipt all atomically).
   *
   * IDEMPOTENCY: uses a Redis GETDEL (read-then-delete atomically) so that
   * double-tapping "Confirm" cannot create two sales.
   */
  async confirmMerchantPayment(reference: string, confirmingUserId: string) {
    const raw = await this.redis.getClient().getdel(`pos:merchant-pay:${reference}`);
    if (!raw) {
      throw new BadRequestException('Payment session expired or already confirmed');
    }

    const pending: PendingMerchantPayment = JSON.parse(raw);

    // Only the cashier who initiated the session (or the stall owner) may confirm it.
    if (pending.cashierId !== confirmingUserId) {
      const stall = await this.prisma.stall.findUnique({
        where: { id: pending.stallId },
        include: { merchant: { select: { userId: true } } },
      });
      const isOwner = stall?.merchant?.userId === confirmingUserId;
      if (!isOwner) {
        throw new ForbiddenException('You did not initiate this payment session');
      }
    }

    const result = await this.processSale({
      stallId: pending.stallId,
      cashierId: pending.cashierId,
      items: pending.items,
      paymentMethod: pending.paymentMethod as PaymentMethod,
      discountAmount: pending.discountAmount,
      discountType: pending.discountType as DiscountType,
      customerPhone: pending.customerPhone,
      deliveryAddress: pending.deliveryAddress,
      notes: pending.notes ?? `Paid via ${pending.paymentMethod} merchant code`,
    });

    return { sale: result.sale, profit: result.profit, commission: result.commission };
  }

  /**
   * Validate and calculate discount for a sale
   */
  async validateDiscount(stallId: string, discountData: {
    code?: string;
    discountId?: string;
    subtotalAmount: number;
  }) {
    // This would integrate with the DiscountsService
    // For now, implement basic validation logic
    
    if (!discountData.code && !discountData.discountId) {
      return { discountAmount: 0, finalAmount: discountData.subtotalAmount };
    }

    try {
      // Find discount by code or ID
      const discount = await this.prisma.discount.findFirst({
        where: {
          stallId,
          isActive: true,
          OR: [
            discountData.code ? { code: discountData.code.toUpperCase() } : {},
            discountData.discountId ? { id: discountData.discountId } : {}
          ].filter(condition => Object.keys(condition).length > 0)
        }
      });

      if (!discount) {
        throw new BadRequestException('Invalid or inactive discount code');
      }

      // Check date validity
      const now = new Date();
      if (discount.startsAt && now < discount.startsAt) {
        throw new BadRequestException('Discount has not started yet');
      }
      if (discount.endsAt && now > discount.endsAt) {
        throw new BadRequestException('Discount has expired');
      }

      // Check usage limit
      if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
        throw new BadRequestException('Discount usage limit has been reached');
      }

      // Check minimum amount
      if (discount.minAmount && discountData.subtotalAmount < parseFloat(discount.minAmount.toString())) {
        throw new BadRequestException(`Minimum amount of $${discount.minAmount} required for this discount`);
      }

      // Calculate discount amount
      let discountAmount = 0;
      const subtotal = new Prisma.Decimal(discountData.subtotalAmount);

      switch (discount.type) {
        case 'PERCENTAGE':
          discountAmount = parseFloat(subtotal.mul(discount.value.div(100)).toString());
          break;
        case 'FIXED_AMOUNT':
          discountAmount = parseFloat(discount.value.toString());
          break;
        case 'BOGO':
          // Simplified BOGO - 50% off
          discountAmount = parseFloat(subtotal.div(2).toString());
          break;
        case 'BOGO_PERCENTAGE':
          // BOGO with percentage off second item
          discountAmount = parseFloat(subtotal.div(2).mul(discount.value.div(100)).toString());
          break;
        default:
          throw new BadRequestException('Invalid discount type');
      }

      // Apply maximum discount limit
      if (discount.maxDiscount && discountAmount > parseFloat(discount.maxDiscount.toString())) {
        discountAmount = parseFloat(discount.maxDiscount.toString());
      }

      // Ensure discount doesn't exceed subtotal
      if (discountAmount > discountData.subtotalAmount) {
        discountAmount = discountData.subtotalAmount;
      }

      const finalAmount = discountData.subtotalAmount - discountAmount;

      return {
        discount,
        discountAmount,
        finalAmount,
        discountType: discount.type,
        discountReason: discount.reason,
        discountCode: discount.code
      };
    } catch (error) {
      throw new BadRequestException(`Discount validation failed: ${error.message}`);
    }
  }

  /**
   * Apply discount and increment usage count
   */
  async applyDiscountToSale(discountId: string) {
    if (!discountId) return;

    return this.prisma.discount.update({
      where: { id: discountId },
      data: {
        usageCount: {
          increment: 1
        }
      }
    });
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
