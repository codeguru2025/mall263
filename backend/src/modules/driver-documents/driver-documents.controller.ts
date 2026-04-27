import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DriverDocumentsService } from './driver-documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole, DriverDocumentType } from '@prisma/client';

@ApiTags('driver-documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('driver/documents')
export class DriverDocumentsController {
  constructor(private readonly service: DriverDocumentsService) {}

  /** Driver submits (or re-submits) a single KYC document URL */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  upload(
    @Req() req: Request & { user: any },
    @Body() body: { type: DriverDocumentType; fileUrl: string },
  ) {
    return this.service.upsertDocument(req.user.id, body.type, body.fileUrl);
  }

  /** Driver views their own document list + onboarding status */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  getMyDocuments(@Req() req: Request & { user: any }) {
    return this.service.getMyDocuments(req.user.id);
  }

  /** Admin views all pending documents for review */
  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN)
  getPending() {
    return this.service.getPendingDocuments();
  }

  /** Admin approves or rejects a specific document */
  @Patch(':docId/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN)
  review(
    @Req() req: Request & { user: any },
    @Param('docId') docId: string,
    @Body() body: { approved: boolean; rejectedReason?: string },
  ) {
    return this.service.reviewDocument(req.user.id, docId, body.approved, body.rejectedReason);
  }
}
