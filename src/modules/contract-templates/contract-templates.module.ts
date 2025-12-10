import { Module } from '@nestjs/common';
import { ContractTemplatesController } from './contract-templates.controller';
import { ContractTemplatesService } from './contract-templates.service';
import { TemplateVariableService } from './services/template-variable.service';

@Module({
  controllers: [ContractTemplatesController],
  providers: [ContractTemplatesService, TemplateVariableService],
  exports: [ContractTemplatesService, TemplateVariableService],
})
export class ContractTemplatesModule {}
