import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DriverDocumentType, DriverDocumentStatus, NotificationType } from '@prisma/client';

const REQUIRED_TYPES = Object.values(DriverDocumentType);

@Injectable()
export class DriverDocumentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async upsertDocument(userId: string, type: DriverDocumentType, fileUrl: string) {
    const driver = await this.prisma.driver.findFirst({ where: { userId }, select: { id: true } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    return this.prisma.driverDocument.upsert({
      where: { driverId_type: { driverId: driver.id, type } },
      create: { driverId: driver.id, type, fileUrl, status: DriverDocumentStatus.PENDING_REVIEW },
      update: {
        fileUrl,
        status: DriverDocumentStatus.PENDING_REVIEW,
        rejectedReason: null,
        reviewedById: null,
        reviewedAt: null,
      },
    });
  }

  async getMyDocuments(userId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { userId },
      select: { id: true, kycVerified: true },
    });
    if (!driver) {
      return { documents: [], kycVerified: false, onboardingComplete: false, approvedCount: 0, totalRequired: REQUIRED_TYPES.length };
    }

    const documents = await this.prisma.driverDocument.findMany({
      where: { driverId: driver.id },
      orderBy: { type: 'asc' },
    });

    const approvedCount = documents.filter((d) => d.status === DriverDocumentStatus.APPROVED).length;
    const onboardingComplete = REQUIRED_TYPES.every((t) =>
      documents.some((d) => d.type === t && d.status === DriverDocumentStatus.APPROVED),
    );

    return {
      documents,
      kycVerified: driver.kycVerified,
      onboardingComplete,
      approvedCount,
      totalRequired: REQUIRED_TYPES.length,
    };
  }

  async reviewDocument(adminId: string, docId: string, approved: boolean, rejectedReason?: string) {
    if (!approved && !rejectedReason) throw new BadRequestException('rejectedReason is required when rejecting');

    const doc = await this.prisma.driverDocument.findUnique({
      where: { id: docId },
      include: { driver: { select: { id: true, userId: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const updated = await this.prisma.driverDocument.update({
      where: { id: docId },
      data: {
        status: approved ? DriverDocumentStatus.APPROVED : DriverDocumentStatus.REJECTED,
        rejectedReason: approved ? null : rejectedReason,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    if (approved) {
      const approvedDocs = await this.prisma.driverDocument.findMany({
        where: { driverId: doc.driverId, status: DriverDocumentStatus.APPROVED },
      });
      if (REQUIRED_TYPES.every((t) => approvedDocs.some((d) => d.type === t))) {
        await this.prisma.driver.update({ where: { id: doc.driverId }, data: { kycVerified: true } });
      }
    }

    const typeName = doc.type.replace(/_/g, ' ').toLowerCase();
    await this.notifications.send(
      doc.driver.userId,
      approved ? NotificationType.DRIVER_DOC_VERIFIED : NotificationType.DRIVER_DOC_REJECTED,
      approved ? 'Document approved' : 'Document rejected',
      approved
        ? `Your ${typeName} has been approved.`
        : `Your ${typeName} was rejected: ${rejectedReason}`,
      { docId, type: doc.type },
    );

    return updated;
  }

  async getPendingDocuments() {
    return this.prisma.driverDocument.findMany({
      where: { status: DriverDocumentStatus.PENDING_REVIEW },
      include: {
        driver: { select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
