import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { PrismaService } from '../../config/prisma.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService, PrismaService],
})
export class AuditModule {}
