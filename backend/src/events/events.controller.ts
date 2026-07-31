import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { EventsService } from './events.service';
import {
  CreateEventDto,
  ListEventsQueryDto,
  UpdateEventDto,
} from './dto/event.dto';
import {
  AddStaffDto,
  CheckoutDto,
  CreateTicketTypeDto,
  RefundOrderDto,
  RegisterDto,
  UpdateTicketTypeDto,
} from './dto/ticket-operations.dto';
import { ActivateExternalDto, CheckinDto } from './dto/external.dto';
import { GetTransactionsQueryDto } from '../ledger/dto/get-transactions-query.dto';
import { CreateReimbursementDto } from '../reimbursements/dto/create-reimbursement.dto';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ── Público (pipeline de snapshots) ───────────────────────────────────────
  // Rotas estáticas declaradas ANTES de ':id'.

  @Get('public/managed')
  @ApiOperation({
    summary:
      'Eventos próprios publicados (shape EventItem + EventSourceConfig)',
  })
  getPublicManagedEvents() {
    return this.eventsService.getPublicManagedEvents();
  }

  @Get('public/managed/:id')
  @ApiOperation({
    summary: 'Evento próprio publicado + ticket types ativos',
  })
  getPublicManagedEvent(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getPublicManagedEvent(id);
  }

  // ── Membro logado ─────────────────────────────────────────────────────────

  @Get('my-registrations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Inscrições do membro logado (qualquer status)' })
  myRegistrations(@Req() req: { user: JwtPayload }) {
    return this.eventsService.myRegistrations(req.user);
  }

  @Get('staff-candidates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Buscar membros para compor staff (nome/handle, máx 20)',
  })
  searchStaffCandidates(
    @Query('query') query: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.searchStaffCandidates(query ?? '', req.user);
  }

  @Get('registrations/:id/certificate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Certificado da inscrição (dono; exige check-in feito)',
  })
  getCertificate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.getCertificate(id, req.user);
  }

  @Get('certificates/verify/:code')
  @ApiOperation({
    summary: 'Verificação PÚBLICA de autenticidade do certificado',
  })
  verifyCertificate(@Param('code') code: string) {
    return this.eventsService.verifyCertificate(code);
  }

  @Get('orders/:id/receipt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Comprovante da order (dono ou event_finance/admin)',
  })
  getReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.getReceipt(id, req.user);
  }

  @Post('orders/:id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_finance')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Estorno total ou parcial da order [admin | event_finance]',
  })
  refundOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundOrderDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.refundOrder(id, dto, req.user);
  }

  @Delete('registrations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Cancelar inscrição (dono, staff do evento ou admin)',
  })
  cancelRegistration(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.cancelRegistration(id, req.user);
  }

  @Patch('ticket-types/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Atualizar tipo de ingresso [event_organizer | admin]',
  })
  updateTicketType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketTypeDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.updateTicketType(id, dto, req.user);
  }

  // ── Gestão (organizer/admin) ──────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      '🔒 Listar eventos (paginado quando page/limit informados) [event_organizer | admin]',
  })
  listEvents(
    @Query() query: ListEventsQueryDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.listEvents(req.user, query);
  }

  @Get('checkin-scope')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Eventos acessíveis para check-in (scanner ou lista, conforme permissão)',
  })
  getCheckinScope(@Req() req: { user: JwtPayload }) {
    return this.eventsService.getCheckinScope(req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Criar evento (draft) [event_organizer | admin]',
  })
  createEvent(@Body() dto: CreateEventDto, @Req() req: { user: JwtPayload }) {
    return this.eventsService.createEvent(dto, req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Detalhe do evento + contagens (organizer/admin/staff)',
  })
  getEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.getEvent(id, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Atualizar evento (organizer/admin; host edita dados básicos)',
  })
  updateEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.updateEvent(id, dto, req.user);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Publicar evento (draft → published)' })
  publishEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.publishEvent(id, req.user);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Cancelar evento' })
  cancelEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.cancelEvent(id, req.user);
  }

  @Post('orders/reconcile-ledger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Reconciliar orders pagas sem transação no ledger',
  })
  reconcilePaidOrdersLedger(@Req() req: { user: JwtPayload }) {
    return this.eventsService.reconcilePaidOrdersLedger(req.user);
  }

  @Post(':id/ticket-types')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Criar tipo de ingresso / lote' })
  createTicketType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketTypeDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.createTicketType(id, dto, req.user);
  }

  @Post(':id/staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Adicionar staff ao evento (host/checker/finance)',
  })
  addStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStaffDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.addStaff(id, dto, req.user);
  }

  @Delete(':id/staff/:staffId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer', 'admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Remover staff do evento' })
  removeStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.removeStaff(id, staffId, req.user);
  }

  // ── Check-in / inscrições / relatório (2c/2d) ────────────────────────────

  @Post(':id/checkin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Check-in via QR (token) — idempotente [checker/host/organizer/admin]',
  })
  checkin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckinDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.checkin(id, dto.token, req.user);
  }

  @Get(':id/registrations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Lista de inscritos do evento (staff/organizer/admin; filtro search)',
  })
  listRegistrations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('search') search: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.listRegistrations(id, { search }, req.user);
  }

  @Get(':id/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Relatório do evento: ocupação, presença e receita [finance/host/organizer/admin]',
  })
  getEventReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.getEventReport(id, req.user);
  }

  @Get(':id/orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      '🔒 Pedidos de ingressos do evento [organizer/admin/finance/staff]',
  })
  listOrders(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.listOrders(id, req.user);
  }

  @Get(':id/ledger')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      '🔒 Transações do ledger deste evento (caixa) [organizer/admin/finance/staff]',
  })
  getEventLedger(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetTransactionsQueryDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.getEventLedger(id, query, req.user);
  }

  @Post(':id/reimbursements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Lançar reembolso/despesa vinculada ao evento [organizer/admin/staff]',
  })
  createEventReimbursement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReimbursementDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.createEventReimbursement(id, dto, req.user);
  }

  @Post('external/:eventKey/reimbursements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Lançar reembolso/despesa vinculada a evento externo [owner/ativador/admin]',
  })
  createExternalEventReimbursement(
    @Param('eventKey') eventKey: string,
    @Body() dto: CreateReimbursementDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.createExternalEventReimbursement(
      eventKey,
      dto,
      req.user,
    );
  }

  // ── Eventos externos à la carte (2d) ─────────────────────────────────────

  @Post('internal/snapshot')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_organizer')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      '🔒 Forçar sync do snapshot internal:codaqui (1 PR multi-arquivo) [admin | event_organizer]',
  })
  syncInternalSnapshot(@Req() req: { user: JwtPayload }) {
    return this.eventsService.syncInternalSnapshot(req.user);
  }

  @Get('external/activations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Ativações visíveis: admin vê todas; demais veem as próprias + ownership',
  })
  listActivations(@Req() req: { user: JwtPayload }) {
    return this.eventsService.listActivations(req.user);
  }

  @Get('public/activations')
  @ApiOperation({
    summary:
      'Ativações de features de eventos externos (público; usado na listagem /eventos)',
  })
  listPublicActivations() {
    return this.eventsService.listPublicActivations();
  }

  @Get('members/:memberId/registrations')
  @ApiOperation({
    summary:
      'Histórico PÚBLICO de participações do membro (confirmed/refunded, sem dados sensíveis)',
  })
  listMemberRegistrations(@Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.eventsService.listMemberRegistrations(memberId);
  }

  @Get('external/:eventKey/ticket-types')
  @ApiOperation({
    summary: 'Tipos de ingresso ATIVOS do evento externo (público; exige feature payments)',
  })
  listExternalTicketTypes(@Param('eventKey') eventKey: string) {
    return this.eventsService.listExternalTicketTypes(eventKey);
  }

  @Get('external/:eventKey/ticket-types/manage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Todos os tipos de ingresso do evento externo (incl. inativos) [owner/admin]',
  })
  listExternalTicketTypesManage(
    @Param('eventKey') eventKey: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.listExternalTicketTypesManage(eventKey, req.user);
  }

  @Post('external/:eventKey/ticket-types')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Criar tipo de ingresso no evento externo (exige feature payments) [owner/admin]',
  })
  createExternalTicketType(
    @Param('eventKey') eventKey: string,
    @Body() dto: CreateTicketTypeDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.createExternalTicketType(eventKey, dto, req.user);
  }

  @Patch('external/ticket-types/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Atualizar tipo de ingresso de evento externo (parcial, incl. isActive) [owner/admin]',
  })
  updateExternalTicketType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketTypeDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.updateExternalTicketType(id, dto, req.user);
  }

  @Post('external/:eventKey/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Checkout de ingressos de evento externo (Stripe — exige acceptTerms e feature payments)',
  })
  checkoutExternal(
    @Param('eventKey') eventKey: string,
    @Body() dto: CheckoutDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.checkoutExternal(eventKey, dto, req.user);
  }

  @Post('external/:eventKey/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Ativar features (checkin/certificates/payments) em evento externo [owner/admin]',
  })
  activateExternal(
    @Param('eventKey') eventKey: string,
    @Body() dto: ActivateExternalDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.activateExternal(eventKey, dto, req.user);
  }

  @Get('external/:eventKey/activation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Ativação atual do evento externo [owner/ativador/admin]',
  })
  getActivation(
    @Param('eventKey') eventKey: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.getActivation(eventKey, req.user);
  }

  @Get('external/:eventKey/orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: '🔒 Pedidos de ingressos do evento externo [owner/admin]',
  })
  listExternalOrders(
    @Param('eventKey') eventKey: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.listExternalOrders(eventKey, req.user);
  }

  @Get('external/:eventKey/ledger')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      '🔒 Transações do ledger deste evento externo (caixa) [owner/admin]',
  })
  getExternalEventLedger(
    @Param('eventKey') eventKey: string,
    @Query() query: GetTransactionsQueryDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.getExternalEventLedger(eventKey, query, req.user);
  }

  @Post('external/:eventKey/participants/import')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Importar participantes via CSV (body text/csv) — dedupe automático',
  })
  importParticipants(
    @Param('eventKey') eventKey: string,
    @Body() csvText: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.importParticipants(eventKey, csvText, req.user);
  }

  @Post('external/:eventKey/participants/rematch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary:
      'Re-tentar match de inscrições pending_match [owner/ativador/admin]',
  })
  rematchParticipants(
    @Param('eventKey') eventKey: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.rematchParticipants(eventKey, req.user);
  }

  @Get('external/:eventKey/participants')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Lista de participantes importados (filtro search)',
  })
  listExternalParticipants(
    @Param('eventKey') eventKey: string,
    @Query('search') search: string,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.listExternalParticipants(
      eventKey,
      { search },
      req.user,
    );
  }

  @Post('external/:eventKey/checkin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Check-in de participante importado (exige feature checkin)',
  })
  checkinExternal(
    @Param('eventKey') eventKey: string,
    @Body() dto: CheckinDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.checkinExternal(eventKey, dto.token, req.user);
  }

  // ── Inscrição / checkout (membro logado) ─────────────────────────────────

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Inscrição gratuita (RSVP — conta obrigatória)' })
  register(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.register(id, dto, req.user);
  }

  @Post(':id/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Checkout de ingressos pagos (Stripe — exige acceptTerms)',
  })
  checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckoutDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.eventsService.checkout(id, dto, req.user);
  }
}
