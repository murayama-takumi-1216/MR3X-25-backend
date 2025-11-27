import { Controller, Get, Param, NotFoundException, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContractTemplatesService } from './contract-templates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Contract Templates')
@Controller('contract-templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContractTemplatesController {
  constructor(private readonly templatesService: ContractTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all contract templates' })
  getAllTemplates() {
    return this.templatesService.getAllTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  getTemplateById(@Param('id') id: string) {
    const template = this.templatesService.getTemplateById(id);

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get templates by type (CTR, ACD, VST)' })
  getTemplatesByType(@Param('type') type: string) {
    if (!['CTR', 'ACD', 'VST'].includes(type)) {
      throw new BadRequestException('Invalid template type. Must be CTR, ACD, or VST');
    }

    return this.templatesService.getTemplatesByType(type as 'CTR' | 'ACD' | 'VST');
  }
}
