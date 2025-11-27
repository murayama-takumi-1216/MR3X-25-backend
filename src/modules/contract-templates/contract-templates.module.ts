import { Module } from '@nestjs/common';
import { ContractTemplatesController } from './contract-templates.controller';
import { ContractTemplatesService } from './contract-templates.service';

@Module({
  controllers: [ContractTemplatesController],
  providers: [ContractTemplatesService],
  exports: [ContractTemplatesService],
})
export class ContractTemplatesModule {}
