import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupportRequestStatus } from '@prisma/client';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportRequestDto } from './dto/update-support-request.dto';

const ZW_PHONE = /^(\+263|0)[0-9]{9}$/;

type JwtUser = { id: string; phone: string; firstName: string; lastName: string };

@Injectable()
export class SupportRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSupportRequestDto, user?: JwtUser | null) {
    let contactName = dto.contactName?.trim() || null;
    let contactPhone = dto.contactPhone?.trim() || null;
    const contactEmail = dto.contactEmail?.trim() || null;

    if (user) {
      if (!contactName) contactName = `${user.firstName} ${user.lastName}`.trim();
      if (!contactPhone) contactPhone = user.phone;
    } else {
      if (!contactName || !contactPhone) {
        throw new BadRequestException('Please provide your name and phone number, or sign in to submit a request.');
      }
      if (!ZW_PHONE.test(contactPhone)) {
        throw new BadRequestException('Phone must be a valid Zimbabwe number (e.g. 0771234567 or +263771234567).');
      }
    }

    return this.prisma.supportRequest.create({
      data: {
        userId: user?.id ?? null,
        contactName,
        contactPhone,
        contactEmail,
        topic: dto.topic.trim(),
        message: dto.message.trim(),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async listForAdmin(params: { status?: SupportRequestStatus; limit?: number }) {
    const { status, limit = 100 } = params;
    const where = status ? { status } : {};
    return this.prisma.supportRequest.findMany({
      where,
      take: Math.min(limit, 200),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, role: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateForAdmin(id: string, dto: UpdateSupportRequestDto) {
    const existing = await this.prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Support request not found');

    const data: {
      status?: SupportRequestStatus;
      adminNotes?: string | null;
      assignedToId?: string | null;
      resolvedAt?: Date | null;
    } = {};

    if (dto.adminNotes !== undefined) data.adminNotes = dto.adminNotes;
    if (Object.prototype.hasOwnProperty.call(dto, 'assignedToId')) {
      data.assignedToId = dto.assignedToId ?? null;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === SupportRequestStatus.RESOLVED || dto.status === SupportRequestStatus.CLOSED) {
        data.resolvedAt = new Date();
      } else if (dto.status === SupportRequestStatus.OPEN || dto.status === SupportRequestStatus.IN_PROGRESS) {
        data.resolvedAt = null;
      }
    }

    return this.prisma.supportRequest.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, role: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
