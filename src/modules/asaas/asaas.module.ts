import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../config/prisma.module';
import { AsaasService } from './asaas.service';
import { AsaasPaymentService } from './asaas-payment.service';
import { AsaasController } from './asaas.controller';
import { AsaasWebhookController } from './asaas-webhook.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AsaasController, AsaasWebhookController],
  providers: [AsaasService, AsaasPaymentService],
  exports: [AsaasService, AsaasPaymentService],
})
export class AsaasModule {}
