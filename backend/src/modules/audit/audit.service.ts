import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  async getByEntity(entity: string, entityId: string, page = 1, limit = 20) {
    const where = { entity, entityId };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getByUser(userId: string, page = 1, limit = 20) {
    const where = { userId };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createFraudAlert(data: {
    userId?: string;
    alertType: string;
    severity: string;
    description: string;
    data?: any;
  }) {
    return this.prisma.fraudAlert.create({ data });
  }

  async getFraudAlerts(params: { isResolved?: boolean; page?: number; limit?: number }) {
    const { isResolved, page = 1, limit = 20 } = params;
    const where: any = {};
    if (isResolved !== undefined) where.isResolved = isResolved;
    const [data, total] = await Promise.all([
      this.prisma.fraudAlert.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.fraudAlert.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async resolveFraudAlert(alertId: string, resolvedBy: string) {
    return this.prisma.fraudAlert.update({
      where: { id: alertId },
      data: { isResolved: true, resolvedBy, resolvedAt: new Date() },
    });
  }
}
