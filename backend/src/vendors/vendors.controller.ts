import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { VendorsService } from './vendors.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { CreateVendorPaymentDto } from './dto/vendor-payment.dto';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/transaction-template.dto';

@ApiTags('vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PÚBLICO
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('public')
  @ApiOperation({
    summary: 'Listar fornecedores (público)',
    description: 'Lista fornecedores ativos com dados públicos para transparência.',
  })
  getPublicVendors() {
    return this.vendorsService.findAllPublic();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN — FORNECEDORES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Listar fornecedores [admin]' })
  getVendors() {
    return this.vendorsService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Criar fornecedor [admin]' })
  @ApiResponse({ status: 201, description: 'Fornecedor criado.' })
  createVendor(@Body() dto: CreateVendorDto) {
    return this.vendorsService.createVendor(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Atualizar fornecedor [admin]' })
  updateVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.updateVendor(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Desativar fornecedor [admin]' })
  deleteVendor(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.softDeleteVendor(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN — PAGAMENTOS A FORNECEDORES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Listar pagamentos a fornecedores [admin]' })
  getPayments() {
    return this.vendorsService.findPayments();
  }

  @Get('payments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Detalhe de pagamento [admin]' })
  getPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.findPaymentById(id);
  }

  /** Rota pública para transparência (resolve referenceId) */
  @Get('payments/by-reference/:refId')
  @ApiOperation({
    summary: 'Buscar pagamento por referência (transparência)',
    description: 'Usado pela página de transparência para resolver vendor-payment:<id>.',
  })
  getPaymentByReference(@Param('refId') refId: string) {
    return this.vendorsService.findPaymentByReferenceId(refId);
  }

  @Post('payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Registrar pagamento a fornecedor [admin]' })
  @ApiResponse({ status: 201, description: 'Pagamento registrado e lançado no ledger.' })
  createPayment(@Body() dto: CreateVendorPaymentDto, @Req() req: { user: JwtPayload }) {
    return this.vendorsService.createPayment(dto, req.user.sub);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN — TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Listar templates [admin]' })
  getTemplates() {
    return this.vendorsService.findTemplates();
  }

  @Post('templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Criar template [admin]' })
  @ApiResponse({ status: 201, description: 'Template criado.' })
  createTemplate(@Body() dto: CreateTemplateDto, @Req() req: { user: JwtPayload }) {
    return this.vendorsService.createTemplate(dto, req.user.sub);
  }

  @Patch('templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Atualizar template [admin]' })
  updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.vendorsService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '🔒 Desativar template [admin]' })
  deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.softDeleteTemplate(id);
  }
}
