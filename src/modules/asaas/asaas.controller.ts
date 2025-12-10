import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AsaasService } from './asaas.service';
import { AsaasPaymentService } from './asaas-payment.service';
import {
  CreateEntityPaymentDto,
  SyncCustomerDto,
  CancelPaymentDto,
  RefundPaymentDto,
  ReceiveInCashDto,
  ListPaymentsDto,
  CreateAsaasCustomerDto,
  CreateDirectPaymentDto,
} from './dto';

@Controller('asaas')
@UseGuards(JwtAuthGuard)
export class AsaasController {
  constructor(
    private asaasService: AsaasService,
    private asaasPaymentService: AsaasPaymentService,
  ) {}

  /**
   * Check if Asaas is configured and enabled
   */
  @Get('status')
  getStatus() {
    return {
      enabled: this.asaasService.isEnabled(),
      message: this.asaasService.isEnabled()
        ? 'Asaas payment gateway is configured and ready'
        : 'Asaas payment gateway is not configured',
    };
  }

  // ==================== PAYMENT ENDPOINTS ====================

  /**
   * Create payment for an entity (invoice, agreement, or microtransaction)
   */
  @Post('payments')
  async createPayment(@Body() dto: CreateEntityPaymentDto, @Request() req: any) {
    const userId = req.user.id;

    switch (dto.entityType) {
      case 'invoice':
        return this.asaasPaymentService.createInvoicePayment({
          invoiceId: dto.entityId,
          userId,
          billingType: dto.billingType,
        });

      case 'agreement':
        return this.asaasPaymentService.createAgreementPayment({
          agreementId: dto.entityId,
          userId,
          billingType: dto.billingType,
        });

      default:
        throw new BadRequestException(`Unsupported entity type: ${dto.entityType}`);
    }
  }

  /**
   * Get payment status
   */
  @Get('payments/:paymentId/status')
  async getPaymentStatus(@Param('paymentId') paymentId: string) {
    return this.asaasPaymentService.getPaymentStatus(paymentId);
  }

  /**
   * Get PIX QR Code for a payment
   */
  @Get('payments/:paymentId/pix')
  async getPixQrCode(@Param('paymentId') paymentId: string) {
    return this.asaasPaymentService.getPixQrCode(paymentId);
  }

  /**
   * Cancel a payment
   */
  @Post('payments/cancel')
  async cancelPayment(@Body() dto: CancelPaymentDto) {
    return this.asaasPaymentService.cancelPayment(dto.paymentId);
  }

  /**
   * Refund a payment
   */
  @Post('payments/refund')
  async refundPayment(@Body() dto: RefundPaymentDto) {
    return this.asaasPaymentService.refundPayment(dto.paymentId, dto.value);
  }

  /**
   * Mark payment as received in cash
   */
  @Post('payments/receive-in-cash')
  async receiveInCash(@Body() dto: ReceiveInCashDto) {
    return this.asaasPaymentService.markAsReceivedInCash(
      dto.paymentId,
      new Date(dto.paymentDate),
      dto.value,
    );
  }

  /**
   * List payments from Asaas
   */
  @Get('payments')
  async listPayments(@Query() query: ListPaymentsDto) {
    return this.asaasService.listPayments({
      customer: query.customerId,
      status: query.status,
      billingType: query.billingType,
      externalReference: query.externalReference,
      offset: query.offset || 0,
      limit: query.limit || 10,
    });
  }

  /**
   * Get payment details from Asaas
   */
  @Get('payments/:paymentId')
  async getPayment(@Param('paymentId') paymentId: string) {
    return this.asaasService.getPayment(paymentId);
  }

  /**
   * Create direct payment in Asaas
   */
  @Post('payments/direct')
  async createDirectPayment(@Body() dto: CreateDirectPaymentDto) {
    return this.asaasService.createCompletePayment({
      customerId: dto.customerId,
      value: dto.value,
      dueDate: dto.dueDate,
      description: dto.description,
      externalReference: dto.externalReference || `manual_${Date.now()}`,
      billingType: dto.billingType,
      installmentCount: dto.installmentCount,
    });
  }

  // ==================== CUSTOMER ENDPOINTS ====================

  /**
   * Sync a user to Asaas
   */
  @Post('customers/sync')
  async syncCustomer(@Body() dto: SyncCustomerDto, @Request() req: any) {
    // Get user data from database
    const { PrismaService } = await import('../../config/prisma.service');
    // Note: In production, inject PrismaService properly
    throw new BadRequestException('Use the entity-specific payment creation instead');
  }

  /**
   * Create customer directly in Asaas
   */
  @Post('customers')
  async createCustomer(@Body() dto: CreateAsaasCustomerDto) {
    return this.asaasService.createCustomer(dto);
  }

  /**
   * Find customer by CPF/CNPJ
   */
  @Get('customers/find')
  async findCustomer(@Query('cpfCnpj') cpfCnpj: string, @Query('externalReference') externalReference: string) {
    if (cpfCnpj) {
      return this.asaasService.findCustomerByCpfCnpj(cpfCnpj);
    }
    if (externalReference) {
      return this.asaasService.findCustomerByExternalReference(externalReference);
    }
    throw new BadRequestException('Provide cpfCnpj or externalReference');
  }

  /**
   * Get customer by ID
   */
  @Get('customers/:customerId')
  async getCustomer(@Param('customerId') customerId: string) {
    return this.asaasService.getCustomer(customerId);
  }

  /**
   * List customers
   */
  @Get('customers')
  async listCustomers(@Query('offset') offset: number = 0, @Query('limit') limit: number = 10) {
    return this.asaasService.listCustomers(offset, limit);
  }

  // ==================== SYNC ENDPOINTS ====================

  /**
   * Sync pending payments (manual trigger)
   */
  @Post('sync/payments')
  async syncPendingPayments(@Query('agencyId') agencyId?: string) {
    return this.asaasPaymentService.syncPendingPayments(agencyId);
  }

  // ==================== INVOICE-SPECIFIC ENDPOINTS ====================

  /**
   * Create payment for specific invoice
   */
  @Post('invoices/:invoiceId/payment')
  async createInvoicePayment(
    @Param('invoiceId') invoiceId: string,
    @Body('billingType') billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED',
    @Request() req: any,
  ) {
    return this.asaasPaymentService.createInvoicePayment({
      invoiceId,
      userId: req.user.id,
      billingType,
    });
  }

  // ==================== AGREEMENT-SPECIFIC ENDPOINTS ====================

  /**
   * Create payment for specific agreement
   */
  @Post('agreements/:agreementId/payment')
  async createAgreementPayment(
    @Param('agreementId') agreementId: string,
    @Body('billingType') billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED',
    @Request() req: any,
  ) {
    return this.asaasPaymentService.createAgreementPayment({
      agreementId,
      userId: req.user.id,
      billingType,
    });
  }
}
