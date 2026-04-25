import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { VirtualWalkService } from './virtual-walk.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { CreateHotspotDto } from './dto/create-hotspot.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('virtual-walk')
export class VirtualWalkController {
  constructor(private readonly virtualWalkService: VirtualWalkService) {}

  // ── Public read endpoints (customer-facing Virtual Store Walk) ─────────────

  @Get('videos/:stallId')
  getVideosByStall(@Param('stallId') stallId: string) {
    return this.virtualWalkService.getVideosByStall(stallId);
  }

  @Get('shop/:stallId')
  getShopWalk(@Param('stallId') stallId: string) {
    return this.virtualWalkService.getVideosByStall(stallId);
  }

  @Get('hotspots/:videoId')
  getHotspotsByVideo(@Param('videoId') videoId: string) {
    return this.virtualWalkService.getHotspotsByVideo(videoId);
  }

  // ── Merchant-only mutations ────────────────────────────────────────────────

  @Post('videos/:stallId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  createVideo(
    @Param('stallId') stallId: string,
    @Body() createVideoDto: CreateVideoDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.virtualWalkService.createVideo(stallId, createVideoDto, currentUserId);
  }

  @Post('hotspots/:videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  createHotspot(
    @Param('videoId') videoId: string,
    @Body() createHotspotDto: CreateHotspotDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.virtualWalkService.createHotspot(videoId, createHotspotDto, currentUserId);
  }

  @Patch('videos/:videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  updateVideo(
    @Param('videoId') videoId: string,
    @Body() updateVideoDto: UpdateVideoDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.virtualWalkService.updateVideo(videoId, updateVideoDto, currentUserId);
  }

  @Delete('videos/:videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  deleteVideo(
    @Param('videoId') videoId: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.virtualWalkService.deleteVideo(videoId, currentUserId);
  }

  @Delete('hotspots/:hotspotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  deleteHotspot(
    @Param('hotspotId') hotspotId: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.virtualWalkService.deleteHotspot(hotspotId, currentUserId);
  }

  @Get('products/:stallId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  getShopProductsForHotspots(
    @Param('stallId') stallId: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.virtualWalkService.getShopProductsForHotspots(stallId, currentUserId);
  }
}
