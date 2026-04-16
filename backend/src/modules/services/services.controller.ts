import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { CreateServiceDto } from './dto/create-service.dto';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  // ── Listings ──────────────────────────────────────────────────────────────────

  @Get('browse')
  @Public()
  @ApiOperation({ summary: 'Browse service listings' })
  async browse(
    @Query('categoryId') categoryId?: string,
    @Query('mallId') mallId?: string,
    @Query('q') q?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.servicesService.browse({ categoryId, mallId, q, page, limit });
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Create a service listing for your stall' })
  async create(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: CreateServiceDto,
  ) {
    return this.servicesService.create(userId, role, body);
  }

  // ── Requests ──────────────────────────────────────────────────────────────────

  @Get('requests/mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Buyer: my service requests" })
  async getMyRequests(@CurrentUser('id') userId: string) {
    return this.servicesService.getMyRequests(userId);
  }

  @Get('requests/incoming')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Provider: incoming requests on my listings" })
  async getProviderRequests(@CurrentUser('id') userId: string) {
    return this.servicesService.getProviderRequests(userId);
  }

  @Get('requests/:requestId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a single service request (client or provider)' })
  async getRequest(@Param('requestId') requestId: string, @CurrentUser('id') userId: string) {
    return this.servicesService.getRequest(requestId, userId);
  }

  @Post(':listingId/requests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Buyer: create a service request for a listing' })
  async createRequest(
    @CurrentUser('id') clientId: string,
    @Param('listingId') listingId: string,
    @Body() body: { notes?: string; budgetHint?: number },
  ) {
    return this.servicesService.createRequest(clientId, listingId, body);
  }

  @Post('requests/:requestId/quote')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Provider: submit a quote for a request' })
  async submitQuote(
    @CurrentUser('id') providerId: string,
    @Param('requestId') requestId: string,
    @Body() body: { amount: number; description?: string; estimatedDays?: number },
  ) {
    return this.servicesService.submitQuote(providerId, requestId, body);
  }

  // ── Quotes ────────────────────────────────────────────────────────────────────

  @Post('quotes/:quoteId/accept')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Client: accept a quote' })
  async acceptQuote(@CurrentUser('id') clientId: string, @Param('quoteId') quoteId: string) {
    return this.servicesService.acceptQuote(clientId, quoteId);
  }

  @Post('quotes/:quoteId/reject')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Client: reject a quote' })
  async rejectQuote(@CurrentUser('id') clientId: string, @Param('quoteId') quoteId: string) {
    return this.servicesService.rejectQuote(clientId, quoteId);
  }

  @Post('quotes/:quoteId/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Provider: mark service complete and generate invoice' })
  async completeService(
    @CurrentUser('id') providerId: string,
    @Param('quoteId') quoteId: string,
    @Body() body: { paymentMethod: string },
  ) {
    return this.servicesService.completeService(providerId, quoteId, body);
  }

  // ── Invoices ──────────────────────────────────────────────────────────────────

  @Get('invoices/:invoiceId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a service invoice (client or provider)' })
  async getInvoice(@Param('invoiceId') invoiceId: string, @CurrentUser('id') userId: string) {
    return this.servicesService.getInvoice(invoiceId, userId);
  }

  @Patch('invoices/:invoiceId/paid')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Provider: mark invoice as paid' })
  async markInvoicePaid(@Param('invoiceId') invoiceId: string, @CurrentUser('id') providerId: string) {
    return this.servicesService.markInvoicePaid(invoiceId, providerId);
  }

  // ── Service chat ──────────────────────────────────────────────────────────────

  @Get('chat/rooms')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'My service chat rooms' })
  async getMyChatRooms(@CurrentUser('id') userId: string) {
    return this.servicesService.getMyServiceChatRooms(userId);
  }

  @Post('chat/rooms/:quoteId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get or create service chat room for an accepted quote' })
  async getOrCreateChatRoom(@Param('quoteId') quoteId: string, @CurrentUser('id') userId: string) {
    return this.servicesService.getOrCreateServiceChatRoom(quoteId, userId);
  }

  @Get('chat/rooms/:roomId/messages')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get messages in a service chat room' })
  async getMessages(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
    @Query('after') after?: string,
  ) {
    return this.servicesService.getServiceMessages(roomId, userId, after);
  }

  @Post('chat/rooms/:roomId/messages')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send a message in a service chat room' })
  async sendMessage(
    @Param('roomId') roomId: string,
    @CurrentUser('id') senderId: string,
    @Body() body: { content: string },
  ) {
    return this.servicesService.sendServiceMessage(roomId, senderId, body.content);
  }

  // ── Listing detail (last to avoid shadowing named routes above) ───────────────

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Service listing detail' })
  async getById(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return this.servicesService.findById(id, userId);
  }
}
