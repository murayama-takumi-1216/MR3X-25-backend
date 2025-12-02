import { Module } from '@nestjs/common';
import { ApiClientController } from './api-client.controller';

@Module({
  controllers: [ApiClientController],
  providers: [],
  exports: [],
})
export class ApiClientModule {}
