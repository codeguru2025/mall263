import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@Injectable()
export class CitiesService {
  constructor(private prisma: PrismaService) {}

  async create(createCityDto: CreateCityDto) {
    const { name, country } = createCityDto;

    // Check if city already exists
    const existingCity = await this.prisma.city.findFirst({
      where: { 
        name: {
          equals: name,
          mode: 'insensitive'
        }
      },
    });

    if (existingCity) {
      throw new ConflictException(`City "${name}" already exists`);
    }

    return this.prisma.city.create({
      data: {
        name,
        country: country || 'ZW',
      },
    });
  }

  async findAll(country?: string) {
    return this.prisma.city.findMany({
      where: country ? { country } : undefined,
      include: {
        malls: {
          select: {
            id: true,
            name: true,
            isActive: true,
            _count: {
              select: { stalls: true }
            }
          },
          orderBy: {
            name: 'asc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  async findOne(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: {
        malls: {
          include: {
            _count: {
              select: { stalls: true }
            }
          },
          orderBy: {
            name: 'asc'
          }
        }
      }
    });

    if (!city) {
      throw new NotFoundException(`City with ID "${id}" not found`);
    }

    return city;
  }

  async update(id: string, updateCityDto: UpdateCityDto) {
    const city = await this.prisma.city.findUnique({
      where: { id }
    });

    if (!city) {
      throw new NotFoundException(`City with ID "${id}" not found`);
    }

    // Check for duplicate name if name is being updated
    if (updateCityDto.name && updateCityDto.name !== city.name) {
      const existingCity = await this.prisma.city.findFirst({
        where: { 
          name: {
            equals: updateCityDto.name,
            mode: 'insensitive'
          },
          id: {
            not: id
          }
        },
      });

      if (existingCity) {
        throw new ConflictException(`City "${updateCityDto.name}" already exists`);
      }
    }

    return this.prisma.city.update({
      where: { id },
      data: updateCityDto,
      include: {
        malls: {
          select: {
            id: true,
            name: true,
            isActive: true,
            _count: {
              select: { stalls: true }
            }
          }
        }
      }
    });
  }

  async remove(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: {
        _count: {
          select: { malls: true }
        }
      }
    });

    if (!city) {
      throw new NotFoundException(`City with ID "${id}" not found`);
    }

    if (city._count.malls > 0) {
      throw new ConflictException(`Cannot delete city "${city.name}" because it has ${city._count.malls} mall(s) associated with it`);
    }

    return this.prisma.city.delete({
      where: { id }
    });
  }
}
