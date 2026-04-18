import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private addressesService: AddressesService) {}

  @Get('me')
  @ApiOperation({ summary: 'List my saved addresses' })
  async list(@CurrentUser('id') userId: string) {
    return this.addressesService.listMyAddresses(userId);
  }

  @Post('me')
  @ApiOperation({ summary: 'Add a saved address' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() data: {
      label: string;
      line1: string;
      line2?: string;
      city: string;
      country?: string;
      isDefault?: boolean;
    },
  ) {
    return this.addressesService.createAddress(userId, data);
  }

  @Patch('me/:id')
  @ApiOperation({ summary: 'Update a saved address' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() data: Partial<{
      label: string;
      line1: string;
      line2: string | null;
      city: string;
      country: string;
      isDefault: boolean;
    }>,
  ) {
    return this.addressesService.updateAddress(id, userId, data);
  }

  @Delete('me/:id')
  @ApiOperation({ summary: 'Delete a saved address' })
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.addressesService.deleteAddress(id, userId);
  }
}
