import { Module } from '@nestjs/common';
import { ApiClientController } from './api-client.controller';
import { ApiClientService } from './api-client.service';
import { PrismaModule } from '../../config/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ApiClientController],
  providers: [ApiClientService],
  exports: [ApiClientService],
})
export class ApiClientModule {}
