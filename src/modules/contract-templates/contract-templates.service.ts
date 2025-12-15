import { Injectable } from '@nestjs/common';
import { contractTemplates, getTemplateById, ContractTemplate } from './contract-templates';

@Injectable()
export class ContractTemplatesService {
  getAllTemplates(): ContractTemplate[] {
    return contractTemplates;
  }

  getTemplateById(id: string): ContractTemplate | undefined {
    return getTemplateById(id);
  }

  getTemplatesByType(type: 'CTR' | 'ACD' | 'VST'): ContractTemplate[] {
    return contractTemplates.filter(template => template.type === type);
  }
}
