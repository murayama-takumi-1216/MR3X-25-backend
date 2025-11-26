import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ValidationService } from './validation.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Validation')
@Controller('validation')
@Public()
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Post('cpf')
  @ApiOperation({ summary: 'Validate CPF' })
  validateCPF(@Body('cpf') cpf: string) {
    return this.validationService.validateCPF(cpf);
  }

  @Post('cnpj')
  @ApiOperation({ summary: 'Validate CNPJ (supports 2026 alphanumeric format)' })
  validateCNPJ(@Body('cnpj') cnpj: string) {
    return this.validationService.validateCNPJ(cnpj);
  }

  @Post('document')
  @ApiOperation({ summary: 'Validate document (auto-detect CPF or CNPJ)' })
  validateDocument(@Body('document') document: string) {
    return this.validationService.validateDocument(document);
  }

  @Post('cep')
  @ApiOperation({ summary: 'Validate CEP' })
  async validateCEP(@Body('cep') cep: string) {
    return this.validationService.validateCEP(cep);
  }

  @Get('cep/:cep')
  @ApiOperation({ summary: 'Get address by CEP' })
  async getCEP(@Param('cep') cep: string) {
    return this.validationService.validateCEP(cep);
  }

  @Post('format/cpf')
  @ApiOperation({ summary: 'Format CPF' })
  formatCPF(@Body('cpf') cpf: string) {
    return { formatted: this.validationService.formatCPF(cpf) };
  }

  @Post('format/cnpj')
  @ApiOperation({ summary: 'Format CNPJ' })
  formatCNPJ(@Body('cnpj') cnpj: string) {
    return { formatted: this.validationService.formatCNPJ(cnpj) };
  }

  @Post('format/cep')
  @ApiOperation({ summary: 'Format CEP' })
  formatCEP(@Body('cep') cep: string) {
    return { formatted: this.validationService.formatCEP(cep) };
  }
}
