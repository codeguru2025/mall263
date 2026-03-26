import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TrustService } from './trust.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Trust')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trust')
export class TrustController {
  constructor(private trustService: TrustService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my trust score' })
  async getMyScore(@CurrentUser('id') userId: string) {
    return this.trustService.getScore(userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user trust score' })
  async getScore(@Param('userId') userId: string) {
    return this.trustService.getScore(userId);
  }

  @Post('recalculate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Recalculate all trust scores (admin)' })
  async recalculateAll() {
    return this.trustService.recalculateAll();
  }
}
