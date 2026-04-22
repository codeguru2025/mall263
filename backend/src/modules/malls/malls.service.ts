import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMallDto } from './dto/create-mall.dto';
import { UpdateMallDto } from './dto/update-mall.dto';

@Injectable()
export class MallsService {
  constructor(private prisma: PrismaService) {}

  async create(createMallDto: CreateMallDto) {
    const { name, cityId, address } = createMallDto;
    let mallId: string | null = null;
    let errorMessage: string | null = null;

    try {
      // Run diagnostics before creating
      const diagnostics = await this.runMallCreationDiagnostics(createMallDto);
      
      if (!diagnostics.passed) {
        // Log the failure
        const errorMsg = diagnostics.errorMessage ?? 'Unknown validation error';
        await this.logMallCreationFailure(undefined, createMallDto, errorMsg);
        throw new BadRequestException(`Mall not created because: ${errorMsg}`);
      }

      // Create the mall
      const mall = await this.prisma.mall.create({
        data: {
          name,
          cityId,
          address,
          latitude: createMallDto.latitude,
          longitude: createMallDto.longitude,
          imageUrl: createMallDto.imageUrl,
        },
        include: {
          city: true,
          _count: {
            select: { stalls: true }
          }
        }
      });

      mallId = mall.id;

      // Log successful creation
      await this.logMallCreationSuccess(mallId, createMallDto);

      return mall;
    } catch (error) {
      if (!mallId && errorMessage) {
        // Already logged above
        throw error;
      }

      // Log unexpected failures
      await this.logMallCreationFailure(
        mallId ?? undefined, 
        createMallDto, 
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  }

  async findAll(cityId?: string, includeInactive = false) {
    return this.prisma.mall.findMany({
      where: cityId ? { cityId } : { isActive: includeInactive ? undefined : true },
      include: {
        city: true,
        _count: {
          select: { stalls: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  async findOne(id: string) {
    const mall = await this.prisma.mall.findUnique({
      where: { id },
      include: {
        city: true,
        stalls: {
          include: {
            merchant: {
              select: {
                id: true,
                businessName: true
              }
            }
          },
          orderBy: {
            name: 'asc'
          }
        },
        _count: {
          select: { stalls: true }
        }
      }
    });

    if (!mall) {
      throw new NotFoundException(`Mall with ID "${id}" not found`);
    }

    return mall;
  }

  async update(id: string, updateMallDto: UpdateMallDto) {
    const mall = await this.prisma.mall.findUnique({
      where: { id }
    });

    if (!mall) {
      throw new NotFoundException(`Mall with ID "${id}" not found`);
    }

    // Check for duplicate name in same city if name is being updated
    if (updateMallDto.name && updateMallDto.name !== mall.name) {
      const existingMall = await this.prisma.mall.findFirst({
        where: { 
          name: {
            equals: updateMallDto.name,
            mode: 'insensitive'
          },
          cityId: mall.cityId,
          id: {
            not: id
          }
        },
      });

      if (existingMall) {
        throw new ConflictException(`Mall "${updateMallDto.name}" already exists in this city`);
      }
    }

    return this.prisma.mall.update({
      where: { id },
      data: updateMallDto,
      include: {
        city: true,
        _count: {
          select: { stalls: true }
        }
      }
    });
  }

  async remove(id: string) {
    const mall = await this.prisma.mall.findUnique({
      where: { id },
      include: {
        _count: {
          select: { stalls: true }
        }
      }
    });

    if (!mall) {
      throw new NotFoundException(`Mall with ID "${id}" not found`);
    }

    if (mall._count.stalls > 0) {
      throw new ConflictException(`Cannot delete mall "${mall.name}" because it has ${mall._count.stalls} stall(s) associated with it`);
    }

    return this.prisma.mall.delete({
      where: { id }
    });
  }

  private async runMallCreationDiagnostics(createMallDto: CreateMallDto) {
    const { name, cityId, address } = createMallDto;

    // Check 1: City exists
    const city = await this.prisma.city.findUnique({
      where: { id: cityId }
    });

    if (!city) {
      return { passed: false, errorMessage: `City with ID "${cityId}" does not exist` };
    }

    // Check 2: Required fields not empty
    if (!name || name.trim().length === 0) {
      return { passed: false, errorMessage: 'Mall name is required' };
    }

    if (!address || address.trim().length === 0) {
      return { passed: false, errorMessage: 'Mall address is required' };
    }

    // Check 3: Duplicate mall name in same city
    const existingMall = await this.prisma.mall.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        },
        cityId
      }
    });

    if (existingMall) {
      return { passed: false, errorMessage: `Mall "${name}" already exists in ${city.name}` };
    }

    // Check 4: Validate coordinates if provided
    if (createMallDto.latitude !== undefined && createMallDto.longitude !== undefined) {
      if (typeof createMallDto.latitude !== 'number' || 
          typeof createMallDto.longitude !== 'number' ||
          createMallDto.latitude < -90 || createMallDto.latitude > 90 ||
          createMallDto.longitude < -180 || createMallDto.longitude > 180) {
        return { passed: false, errorMessage: 'Invalid latitude/longitude coordinates' };
      }
    }

    return { passed: true, errorMessage: null };
  }

  private async logMallCreationSuccess(mallId: string, payload: CreateMallDto) {
    try {
      await this.prisma.mallCreationLog.create({
        data: {
          mallId,
          payload: payload as unknown as Prisma.InputJsonValue,
          success: true,
        }
      });
    } catch (error) {
      // Don't throw errors from logging to avoid affecting main flow
      console.error('Failed to log mall creation success:', error);
    }
  }

  private async logMallCreationFailure(mallId: string | undefined, payload: CreateMallDto, errorMessage: string) {
    try {
      await this.prisma.mallCreationLog.create({
        data: {
          mallId,
          payload: payload as unknown as Prisma.InputJsonValue,
          errorMessage,
          success: false,
        }
      });
    } catch (error) {
      // Don't throw errors from logging to avoid affecting main flow
      console.error('Failed to log mall creation failure:', error);
    }
  }

  async getCreationLogs(mallId?: string) {
    return this.prisma.mallCreationLog.findMany({
      where: mallId ? { mallId } : undefined,
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to last 100 logs
    });
  }
}
