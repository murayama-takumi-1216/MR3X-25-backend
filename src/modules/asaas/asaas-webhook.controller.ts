import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { AsaasWebhookPayload, AsaasWebhookEvent } from './interfaces/asaas.interfaces';
import { AsaasService } from './asaas.service';
import * as crypto from 'crypto';

@Controller('webhooks/asaas')
export class AsaasWebhookController {
  private readonly logger = new Logger(AsaasWebhookController.name);
  private webhookToken: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private asaasService: AsaasService,
  ) {
    this.webhookToken = this.configService.get<string>('ASAAS_WEBHOOK_TOKEN') || '';
  }

  private verifyWebhook(token: string): boolean {
    if (!this.webhookToken) {
      this.logger.warn('Webhook token not configured, accepting all webhooks');
      return true;
    }
    return token === this.webhookToken;
  }

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() payload: AsaasWebhookPayload,
    @Headers('asaas-access-token') accessToken: string,
  ) {
    if (!this.verifyWebhook(accessToken)) {
      this.logger.warn('Invalid webhook token received');
      throw new BadRequestException('Invalid webhook token');
    }

    this.logger.log(`Received Asaas webhook: ${payload.event}`);

    try {
      await this.logWebhook(payload);

      switch (payload.event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          await this.handlePaymentReceived(payload);
          break;

        case 'PAYMENT_OVERDUE':
          await this.handlePaymentOverdue(payload);
          break;

        case 'PAYMENT_DELETED':
          await this.handlePaymentDeleted(payload);
          break;

        case 'PAYMENT_REFUNDED':
        case 'PAYMENT_PARTIALLY_REFUNDED':
          await this.handlePaymentRefunded(payload);
          break;

        case 'PAYMENT_CREATED':
        case 'PAYMENT_UPDATED':
          await this.handlePaymentUpdated(payload);
          break;

        default:
          this.logger.log(`Unhandled webhook event: ${payload.event}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`);
      return { received: true, error: error.message };
    }
  }

  private async logWebhook(payload: AsaasWebhookPayload) {
    try {
      await this.prisma.webhookLog.create({
        data: {
          provider: 'ASAAS',
          event: payload.event,
          payloadId: payload.payment?.id || 'unknown',
          payload: JSON.stringify(payload),
          status: 'RECEIVED',
        },
      });
    } catch (error) {
      this.logger.debug('Could not log webhook to database', error.message);
    }
  }

  private async handlePaymentReceived(payload: AsaasWebhookPayload) {
    const payment = payload.payment;
    const externalRef = payment.externalReference;

    if (!externalRef) {
      this.logger.warn(`Payment ${payment.id} has no external reference`);
      return;
    }

    // Handle both colon and underscore separators for external references
    // Format can be: entityType:entityId or entityType_entityId_param
    let parts: string[];
    let entityType: string;
    let entityId: string;

    if (externalRef.startsWith('plan_change_')) {
      // Format: plan_change_agencyId_newPlan
      parts = externalRef.split('_');
      entityType = 'plan_change';
      entityId = parts[2]; // agencyId
    } else if (externalRef.includes(':')) {
      parts = externalRef.split(':');
      entityType = parts[0];
      entityId = parts[1];
    } else {
      this.logger.warn(`Unknown external reference format: ${externalRef}`);
      return;
    }

    const paymentDate = payment.paymentDate || payment.confirmedDate || new Date().toISOString();
    const internalStatus = this.asaasService.mapPaymentStatus(payment.status);

    switch (entityType) {
      case 'invoice':
        await this.updateInvoicePayment(entityId, payment, paymentDate, internalStatus);
        break;

      case 'agreement':
        await this.updateAgreementPayment(entityId, payment, paymentDate, internalStatus);
        break;

      case 'microtransaction':
        await this.updateMicrotransactionPayment(entityId, payment, paymentDate);
        break;

      case 'plan_change':
        // Format: plan_change_agencyId_newPlan
        const newPlan = externalRef.startsWith('plan_change_') ? parts[3] : parts[2];
        await this.handlePlanChangePayment(entityId, newPlan, payment, paymentDate);
        break;

      default:
        this.logger.warn(`Unknown entity type: ${entityType}`);
    }
  }

  private async updateInvoicePayment(
    invoiceId: string,
    payment: any,
    paymentDate: string,
    status: string,
  ) {
    try {
      await this.prisma.invoice.update({
        where: { id: BigInt(invoiceId) },
        data: {
          status: status === 'PAID' ? 'PAID' : status,
          paidValue: payment.value,
          paidAt: new Date(paymentDate),
          paymentMethod: payment.billingType,
          webhookStatus: payment.status,
          lastWebhookAt: new Date(),
          syncedAt: new Date(),
        },
      });

      this.logger.log(`Invoice ${invoiceId} marked as ${status}`);

      const invoice = await this.prisma.invoice.findUnique({
        where: { id: BigInt(invoiceId) },
        include: { contract: true },
      });

      if (invoice && status === 'PAID' && invoice.propertyId && invoice.tenantId) {
        await this.prisma.payment.create({
          data: {
            propertyId: invoice.propertyId,
            contratoId: invoice.contractId ?? undefined,
            userId: invoice.tenantId,
            agencyId: invoice.agencyId ?? undefined,
            valorPago: payment.value,
            dataPagamento: new Date(paymentDate),
            dueDate: invoice.dueDate,
            status: 'PAGO',
            paymentMethod: payment.billingType,
            tipo: 'ALUGUEL',
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to update invoice ${invoiceId}: ${error.message}`);
    }
  }

  private async updateAgreementPayment(
    agreementId: string,
    payment: any,
    paymentDate: string,
    status: string,
  ) {
    try {
      const updateData: any = {
        paymentStatus: status === 'PAID' ? 'PAID' : payment.status,
      };

      if (status === 'PAID') {
        updateData.status = 'CONCLUIDO';
      }

      await this.prisma.agreement.update({
        where: { id: BigInt(agreementId) },
        data: updateData,
      });

      this.logger.log(`Agreement ${agreementId} payment status updated to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update agreement ${agreementId}: ${error.message}`);
    }
  }

  private async updateMicrotransactionPayment(
    microtransactionId: string,
    payment: any,
    paymentDate: string,
  ) {
    try {
      await this.prisma.microtransaction.update({
        where: { id: BigInt(microtransactionId) },
        data: {
          status: 'PAID',
          paidAt: new Date(paymentDate),
          asaasPaymentId: payment.id,
          paymentMethod: payment.billingType,
        },
      });

      this.logger.log(`Microtransaction ${microtransactionId} marked as PAID`);
    } catch (error) {
      this.logger.error(`Failed to update microtransaction ${microtransactionId}: ${error.message}`);
    }
  }

  private async handlePaymentOverdue(payload: AsaasWebhookPayload) {
    const payment = payload.payment;
    const externalRef = payment.externalReference;

    if (!externalRef) return;

    const [entityType, entityId] = externalRef.split(':');

    if (entityType === 'invoice') {
      try {
        await this.prisma.invoice.update({
          where: { id: BigInt(entityId) },
          data: {
            status: 'OVERDUE',
            webhookStatus: payment.status,
            lastWebhookAt: new Date(),
          },
        });
        this.logger.log(`Invoice ${entityId} marked as OVERDUE`);
      } catch (error) {
        this.logger.error(`Failed to update invoice ${entityId}: ${error.message}`);
      }
    }
  }

  private async handlePaymentDeleted(payload: AsaasWebhookPayload) {
    const payment = payload.payment;
    const externalRef = payment.externalReference;

    if (!externalRef) return;

    const [entityType, entityId] = externalRef.split(':');

    if (entityType === 'invoice') {
      try {
        await this.prisma.invoice.update({
          where: { id: BigInt(entityId) },
          data: {
            status: 'CANCELLED',
            webhookStatus: payment.status,
            lastWebhookAt: new Date(),
          },
        });
        this.logger.log(`Invoice ${entityId} marked as CANCELLED`);
      } catch (error) {
        this.logger.error(`Failed to update invoice ${entityId}: ${error.message}`);
      }
    }
  }

  private async handlePaymentRefunded(payload: AsaasWebhookPayload) {
    const payment = payload.payment;
    const externalRef = payment.externalReference;

    if (!externalRef) return;

    const [entityType, entityId] = externalRef.split(':');

    if (entityType === 'invoice') {
      try {
        await this.prisma.invoice.update({
          where: { id: BigInt(entityId) },
          data: {
            webhookStatus: payment.status,
            lastWebhookAt: new Date(),
          },
        });
        this.logger.log(`Invoice ${entityId} refund processed`);
      } catch (error) {
        this.logger.error(`Failed to update invoice ${entityId}: ${error.message}`);
      }
    }
  }

  private async handlePaymentUpdated(payload: AsaasWebhookPayload) {
    const payment = payload.payment;
    const externalRef = payment.externalReference;

    if (!externalRef) return;

    const [entityType, entityId] = externalRef.split(':');

    if (entityType === 'invoice') {
      try {
        await this.prisma.invoice.update({
          where: { id: BigInt(entityId) },
          data: {
            asaasId: payment.id,
            paymentLink: payment.invoiceUrl,
            boletoUrl: payment.bankSlipUrl,
            webhookStatus: payment.status,
            lastWebhookAt: new Date(),
            syncedAt: new Date(),
          },
        });
        this.logger.log(`Invoice ${entityId} synced with Asaas payment ${payment.id}`);
      } catch (error) {
        this.logger.error(`Failed to sync invoice ${entityId}: ${error.message}`);
      }
    } else if (entityType === 'agreement') {
      try {
        await this.prisma.agreement.update({
          where: { id: BigInt(entityId) },
          data: {
            asaasPaymentId: payment.id,
            asaasPaymentLink: payment.invoiceUrl,
            paymentStatus: payment.status,
          },
        });
        this.logger.log(`Agreement ${entityId} synced with Asaas payment ${payment.id}`);
      } catch (error) {
        this.logger.error(`Failed to sync agreement ${entityId}: ${error.message}`);
      }
    }
  }

  private async handlePlanChangePayment(
    agencyId: string,
    newPlan: string,
    payment: any,
    paymentDate: string,
  ) {
    try {
      this.logger.log(`Processing plan change payment for agency ${agencyId} to plan ${newPlan}`);

      // Verify agency exists
      const agency = await this.prisma.agency.findUnique({
        where: { id: BigInt(agencyId) },
        select: {
          id: true,
          plan: true,
        },
      });

      if (!agency) {
        this.logger.error(`Agency not found for plan change: ${agencyId}`);
        return;
      }

      // Import plan limits
      const { getPlanLimitsForEntity } = await import('../plans/plans.data');

      const newPlanLimits = getPlanLimitsForEntity(newPlan, 'agency');

      // Update agency with new plan (core fields that always exist)
      const updateData: any = {
        plan: newPlan,
        maxProperties: newPlanLimits.contracts,
        maxUsers: newPlanLimits.users,
        lastPlanChange: new Date(),
        lastPaymentAt: new Date(paymentDate),
        lastPaymentAmount: payment.value,
      };

      // Try to clear pending fields if they exist
      try {
        await this.prisma.agency.update({
          where: { id: BigInt(agencyId) },
          data: {
            ...updateData,
            pendingPlanChange: null,
            pendingPlanPaymentId: null,
          },
        });
      } catch (fieldError) {
        // If pending fields don't exist, update without them
        this.logger.warn(`Updating without pending fields: ${fieldError.message}`);
        await this.prisma.agency.update({
          where: { id: BigInt(agencyId) },
          data: updateData,
        });
      }

      this.logger.log(`Plan change confirmed for agency ${agencyId}: ${newPlan} (payment: ${payment.id})`);
    } catch (error) {
      this.logger.error(`Failed to process plan change for agency ${agencyId}: ${error.message}`);
    }
  }
}
