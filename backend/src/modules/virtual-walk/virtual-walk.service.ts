import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { CreateHotspotDto } from './dto/create-hotspot.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

export interface AisleGroup {
  aisleName: string;
  shelves: Array<{
    shelfLayer: string;
    video: {
      id: string;
      videoUrl: string;
      thumbnailUrl: string | null;
      duration: number | null;
      hotspots: unknown[];
    };
  }>;
}

@Injectable()
export class VirtualWalkService {
  constructor(private prisma: PrismaService) {}

  async createVideo(stallId: string, createVideoDto: CreateVideoDto, currentUserId: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });

    if (!stall) {
      throw new NotFoundException(`Stall with ID "${stallId}" not found`);
    }

    if (stall.merchant.userId !== currentUserId) {
      throw new ForbiddenException('You do not have permission to add videos to this stall');
    }

    return this.prisma.shopVirtualWalkVideo.create({
      data: {
        shopId: stallId,
        aisleName: createVideoDto.aisleName,
        shelfLayer: createVideoDto.shelfLayer,
        videoUrl: createVideoDto.videoUrl,
        thumbnailUrl: createVideoDto.thumbnailUrl,
        duration: createVideoDto.duration,
        fileSize: createVideoDto.fileSize,
      },
      include: {
        hotspots: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
  }

  async getVideosByStall(stallId: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      select: { id: true, name: true },
    });

    if (!stall) {
      throw new NotFoundException(`Stall with ID "${stallId}" not found`);
    }

    const videos = await this.prisma.shopVirtualWalkVideo.findMany({
      where: { shopId: stallId, isActive: true },
      include: {
        hotspots: {
          where: { isActive: true },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                minPrice: true,
                maxPrice: true,
                currency: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: [{ aisleName: 'asc' }, { shelfLayer: 'asc' }],
    });

    // Group by aisle → shelf layer for the client walk UI
    const grouped = videos.reduce<Record<string, AisleGroup>>((acc, video) => {
      if (!acc[video.aisleName]) {
        acc[video.aisleName] = { aisleName: video.aisleName, shelves: [] };
      }
      acc[video.aisleName].shelves.push({
        shelfLayer: video.shelfLayer,
        video: {
          id: video.id,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          hotspots: video.hotspots,
        },
      });
      return acc;
    }, {});

    return Object.values(grouped);
  }

  async createHotspot(videoId: string, createHotspotDto: CreateHotspotDto, currentUserId: string) {
    const video = await this.prisma.shopVirtualWalkVideo.findUnique({
      where: { id: videoId },
      include: {
        shop: { include: { merchant: { select: { userId: true } } } },
      },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID "${videoId}" not found`);
    }

    if (video.shop.merchant.userId !== currentUserId) {
      throw new ForbiddenException('You do not have permission to add hotspots to this video');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: createHotspotDto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${createHotspotDto.productId}" not found`);
    }

    if (product.stallId !== video.shopId) {
      throw new BadRequestException('Product must belong to the same stall as the video');
    }

    if (
      createHotspotDto.xCoord < 0 ||
      createHotspotDto.xCoord > 1 ||
      createHotspotDto.yCoord < 0 ||
      createHotspotDto.yCoord > 1
    ) {
      throw new BadRequestException('Coordinates must be between 0 and 1 (normalized)');
    }

    const videoDuration = video.duration || 0;
    if (
      createHotspotDto.timestamp < 0 ||
      (videoDuration > 0 && createHotspotDto.timestamp > videoDuration)
    ) {
      throw new BadRequestException('Timestamp must be within video duration');
    }

    return this.prisma.videoHotspot.create({
      data: {
        videoId,
        timestamp: createHotspotDto.timestamp,
        xCoord: createHotspotDto.xCoord,
        yCoord: createHotspotDto.yCoord,
        productId: createHotspotDto.productId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            minPrice: true,
            maxPrice: true,
            currency: true,
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });
  }

  async getHotspotsByVideo(videoId: string) {
    const video = await this.prisma.shopVirtualWalkVideo.findUnique({
      where: { id: videoId },
      select: { id: true, isActive: true },
    });

    if (!video || !video.isActive) {
      throw new NotFoundException(`Video with ID "${videoId}" not found or inactive`);
    }

    return this.prisma.videoHotspot.findMany({
      where: { videoId, isActive: true },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            minPrice: true,
            maxPrice: true,
            currency: true,
            status: true,
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  async updateVideo(videoId: string, updateVideoDto: UpdateVideoDto, currentUserId: string) {
    const video = await this.prisma.shopVirtualWalkVideo.findUnique({
      where: { id: videoId },
      include: {
        shop: { include: { merchant: { select: { userId: true } } } },
      },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID "${videoId}" not found`);
    }

    if (video.shop.merchant.userId !== currentUserId) {
      throw new ForbiddenException('You do not have permission to update this video');
    }

    return this.prisma.shopVirtualWalkVideo.update({
      where: { id: videoId },
      data: updateVideoDto,
      include: {
        hotspots: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async deleteVideo(videoId: string, currentUserId: string) {
    const video = await this.prisma.shopVirtualWalkVideo.findUnique({
      where: { id: videoId },
      include: {
        shop: { include: { merchant: { select: { userId: true } } } },
      },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID "${videoId}" not found`);
    }

    if (video.shop.merchant.userId !== currentUserId) {
      throw new ForbiddenException('You do not have permission to delete this video');
    }

    return this.prisma.shopVirtualWalkVideo.update({
      where: { id: videoId },
      data: { isActive: false },
    });
  }

  async deleteHotspot(hotspotId: string, currentUserId: string) {
    const hotspot = await this.prisma.videoHotspot.findUnique({
      where: { id: hotspotId },
      include: {
        video: {
          include: {
            shop: { include: { merchant: { select: { userId: true } } } },
          },
        },
      },
    });

    if (!hotspot) {
      throw new NotFoundException(`Hotspot with ID "${hotspotId}" not found`);
    }

    if (hotspot.video.shop.merchant.userId !== currentUserId) {
      throw new ForbiddenException('You do not have permission to delete this hotspot');
    }

    return this.prisma.videoHotspot.update({
      where: { id: hotspotId },
      data: { isActive: false },
    });
  }

  async getShopProductsForHotspots(stallId: string, currentUserId: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });

    if (!stall) {
      throw new NotFoundException(`Stall with ID "${stallId}" not found`);
    }

    if (stall.merchant.userId !== currentUserId) {
      throw new ForbiddenException('You do not have permission to view products for this stall');
    }

    return this.prisma.product.findMany({
      where: { stallId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
        minPrice: true,
        maxPrice: true,
        currency: true,
        images: {
          where: { isPrimary: true },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
