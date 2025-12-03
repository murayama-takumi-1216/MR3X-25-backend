import { Module } from '@nestjs/common';
import { SalesRepController } from './sales-rep.controller';
import { SalesMessageService } from './sales-message.service';
import { SalesRepService } from './sales-rep.service';
import { PrismaModule } from '../../config/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SalesRepController],
  providers: [SalesMessageService, SalesRepService],
  exports: [SalesMessageService, SalesRepService],
})
export class SalesRepModule {}
