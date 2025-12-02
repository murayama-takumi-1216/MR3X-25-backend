import { Module } from '@nestjs/common';
import { SalesRepController } from './sales-rep.controller';

@Module({
  controllers: [SalesRepController],
  providers: [],
  exports: [],
})
export class SalesRepModule {}
