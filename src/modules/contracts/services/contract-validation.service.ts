import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';

/**
 * Required fields for legal validity of rental contracts
 * Based on Brazilian Lei do Inquilinato (Lei nº 8.245/91)
 */
export interface RequiredContractField {
  field: string;
  label: string;
  category: 'financial' | 'temporal' | 'parties' | 'property' | 'legal';
  description: string;
  legalBasis?: string;
}

export interface ValidationError {
  field: string;
  label: string;
  message: string;
  category: string;
}

export interface ContractValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  checkedFields: number;
  passedFields: number;
  score: number; // Percentage of valid fields
}

export interface ValidationWarning {
  field: string;
  label: string;
  message: string;
  recommendation: string;
}

@Injectable()
export class ContractValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Required fields for rental contracts (Lei do Inquilinato)
   */
  private readonly requiredFields: RequiredContractField[] = [
    // Financial Fields - OBRIGATÓRIOS
    {
      field: 'monthlyRent',
      label: 'Valor do Aluguel',
      category: 'financial',
      description: 'Valor mensal do aluguel em reais',
      legalBasis: 'Art. 17 - O locador não poderá cobrar antecipadamente o aluguel',
    },
    {
      field: 'dueDay',
      label: 'Dia de Vencimento',
      category: 'financial',
      description: 'Dia do mês para vencimento do aluguel',
      legalBasis: 'Art. 23, I - O locatário é obrigado a pagar pontualmente o aluguel',
    },
    {
      field: 'readjustmentIndex',
      label: 'Índice de Reajuste',
      category: 'financial',
      description: 'Índice econômico para reajuste anual (IGPM, IPCA, INPC, etc.)',
      legalBasis: 'Art. 17 - O aluguel pode ser livremente convencionado, vedada sua estipulação em moeda estrangeira',
    },
    {
      field: 'lateFeePercent',
      label: 'Multa por Atraso',
      category: 'financial',
      description: 'Percentual de multa por atraso no pagamento (máximo 10%)',
      legalBasis: 'Art. 413 do Código Civil - A penalidade deve ser reduzida equitativamente',
    },
    {
      field: 'interestRatePercent',
      label: 'Juros de Mora',
      category: 'financial',
      description: 'Percentual de juros moratórios ao mês (máximo 1%)',
      legalBasis: 'Art. 406 do Código Civil - Taxa legal de juros moratórios',
    },

    // Temporal Fields - OBRIGATÓRIOS
    {
      field: 'startDate',
      label: 'Data de Início',
      category: 'temporal',
      description: 'Data de início da vigência do contrato',
      legalBasis: 'Art. 3º - O contrato de locação pode ser ajustado por qualquer prazo',
    },
    {
      field: 'endDate',
      label: 'Data de Término',
      category: 'temporal',
      description: 'Data de término da vigência do contrato',
      legalBasis: 'Art. 3º - Dependendo da vontade das partes',
    },

    // Parties Fields - OBRIGATÓRIOS
    {
      field: 'tenantId',
      label: 'Locatário',
      category: 'parties',
      description: 'Identificação do locatário (inquilino)',
      legalBasis: 'Art. 1º - A locação de imóvel urbano regula-se pelo disposto nesta Lei',
    },
    {
      field: 'ownerId',
      label: 'Locador',
      category: 'parties',
      description: 'Identificação do locador (proprietário)',
      legalBasis: 'Art. 1º - A locação de imóvel urbano regula-se pelo disposto nesta Lei',
    },

    // Property Fields - OBRIGATÓRIOS
    {
      field: 'propertyId',
      label: 'Imóvel',
      category: 'property',
      description: 'Identificação do imóvel objeto da locação',
      legalBasis: 'Art. 1º - Objeto da locação é o imóvel urbano',
    },

    // Legal Fields - OBRIGATÓRIOS
    {
      field: 'earlyTerminationPenaltyPercent',
      label: 'Multa por Rescisão Antecipada',
      category: 'legal',
      description: 'Penalidade proporcional ao tempo restante do contrato',
      legalBasis: 'Art. 4º - Durante o prazo, o locatário não poderá devolver o imóvel senão pagando multa pactuada',
    },
  ];

  /**
   * Valid readjustment indexes accepted by law
   */
  private readonly validIndexes = [
    'IGPM', // Índice Geral de Preços do Mercado
    'IPCA', // Índice de Preços ao Consumidor Amplo
    'INPC', // Índice Nacional de Preços ao Consumidor
    'SELIC', // Taxa SELIC
    'CDI', // Certificado de Depósito Interbancário
    'IPC', // Índice de Preços ao Consumidor
    'IGP-DI', // Índice Geral de Preços - Disponibilidade Interna
  ];

  /**
   * Validate contract for required fields and legal compliance
   */
  async validateContract(contractId: bigint): Promise<ContractValidationResult> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
        agency: true,
      },
    });

    if (!contract) {
      throw new BadRequestException('Contrato não encontrado');
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let passedFields = 0;

    // Validate each required field
    for (const field of this.requiredFields) {
      const value = this.getFieldValue(contract, field.field);
      const validation = this.validateField(field, value, contract);

      if (validation.error) {
        errors.push(validation.error);
      } else {
        passedFields++;
      }

      if (validation.warning) {
        warnings.push(validation.warning);
      }
    }

    // Additional validations
    const additionalValidations = await this.performAdditionalValidations(contract);
    errors.push(...additionalValidations.errors);
    warnings.push(...additionalValidations.warnings);

    const checkedFields = this.requiredFields.length;
    const score = Math.round((passedFields / checkedFields) * 100);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedFields,
      passedFields,
      score,
    };
  }

  /**
   * Get field value from contract object
   */
  private getFieldValue(contract: any, field: string): any {
    return contract[field];
  }

  /**
   * Validate individual field
   */
  private validateField(
    field: RequiredContractField,
    value: any,
    contract: any,
  ): { error: ValidationError | null; warning: ValidationWarning | null } {
    let error: ValidationError | null = null;
    let warning: ValidationWarning | null = null;

    // Check if value exists
    if (value === null || value === undefined || value === '') {
      error = {
        field: field.field,
        label: field.label,
        message: `Campo obrigatório não preenchido: ${field.label}`,
        category: field.category,
      };
      return { error, warning };
    }

    // Field-specific validations
    switch (field.field) {
      case 'monthlyRent':
        const rent = Number(value);
        if (isNaN(rent) || rent <= 0) {
          error = {
            field: field.field,
            label: field.label,
            message: 'O valor do aluguel deve ser maior que zero',
            category: field.category,
          };
        } else if (rent < 100) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Valor do aluguel muito baixo',
            recommendation: 'Verifique se o valor está correto',
          };
        }
        break;

      case 'dueDay':
        const day = Number(value);
        if (isNaN(day) || day < 1 || day > 31) {
          error = {
            field: field.field,
            label: field.label,
            message: 'O dia de vencimento deve estar entre 1 e 31',
            category: field.category,
          };
        } else if (day > 28) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Dia de vencimento pode não existir em todos os meses',
            recommendation: 'Considere usar dia 28 ou anterior para evitar problemas em fevereiro',
          };
        }
        break;

      case 'readjustmentIndex':
        if (!this.validIndexes.includes(value.toUpperCase())) {
          warning = {
            field: field.field,
            label: field.label,
            message: `Índice "${value}" não é um dos índices padrão`,
            recommendation: `Recomenda-se usar: ${this.validIndexes.join(', ')}`,
          };
        }
        break;

      case 'lateFeePercent':
        const lateFee = Number(value);
        if (isNaN(lateFee) || lateFee < 0) {
          error = {
            field: field.field,
            label: field.label,
            message: 'A multa por atraso deve ser um valor válido',
            category: field.category,
          };
        } else if (lateFee > 10) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Multa superior a 10% pode ser considerada abusiva',
            recommendation: 'Art. 413 CC - A penalidade deve ser reduzida equitativamente pelo juiz',
          };
        }
        break;

      case 'interestRatePercent':
        const interest = Number(value);
        if (isNaN(interest) || interest < 0) {
          error = {
            field: field.field,
            label: field.label,
            message: 'Os juros de mora devem ser um valor válido',
            category: field.category,
          };
        } else if (interest > 1) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Juros superiores a 1% ao mês podem ser considerados usura',
            recommendation: 'Art. 406 CC - Taxa legal de juros é de 1% ao mês',
          };
        }
        break;

      case 'startDate':
      case 'endDate':
        if (!(value instanceof Date) && isNaN(new Date(value).getTime())) {
          error = {
            field: field.field,
            label: field.label,
            message: `Data inválida para ${field.label}`,
            category: field.category,
          };
        }
        break;

      case 'earlyTerminationPenaltyPercent':
        const penalty = Number(value);
        if (isNaN(penalty) || penalty < 0) {
          error = {
            field: field.field,
            label: field.label,
            message: 'A multa por rescisão deve ser um valor válido',
            category: field.category,
          };
        } else if (penalty > 3) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Multa de rescisão superior a 3 aluguéis pode ser considerada abusiva',
            recommendation: 'Art. 4º Lei 8.245/91 - A multa deve ser proporcional ao prazo restante',
          };
        }
        break;
    }

    return { error, warning };
  }

  /**
   * Perform additional business logic validations
   */
  private async performAdditionalValidations(contract: any): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate date range
    if (contract.startDate && contract.endDate) {
      const start = new Date(contract.startDate);
      const end = new Date(contract.endDate);

      if (end <= start) {
        errors.push({
          field: 'endDate',
          label: 'Data de Término',
          message: 'A data de término deve ser posterior à data de início',
          category: 'temporal',
        });
      }

      // Check contract duration
      const durationMonths = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (durationMonths < 12) {
        warnings.push({
          field: 'duration',
          label: 'Duração do Contrato',
          message: 'Contratos com menos de 12 meses têm proteção reduzida',
          recommendation: 'Art. 47 Lei 8.245/91 - Contratos de 30+ meses oferecem mais segurança ao locatário',
        });
      }
    }

    // Validate tenant information
    if (contract.tenantUser) {
      if (!contract.tenantUser.document) {
        warnings.push({
          field: 'tenantDocument',
          label: 'Documento do Locatário',
          message: 'Locatário sem CPF/CNPJ cadastrado',
          recommendation: 'O CPF/CNPJ é essencial para validade jurídica do contrato',
        });
      }
      if (!contract.tenantUser.email) {
        warnings.push({
          field: 'tenantEmail',
          label: 'E-mail do Locatário',
          message: 'Locatário sem e-mail cadastrado',
          recommendation: 'O e-mail é necessário para notificações e assinatura digital',
        });
      }
    }

    // Validate owner information
    if (contract.ownerUser) {
      if (!contract.ownerUser.document) {
        warnings.push({
          field: 'ownerDocument',
          label: 'Documento do Locador',
          message: 'Locador sem CPF/CNPJ cadastrado',
          recommendation: 'O CPF/CNPJ é essencial para validade jurídica do contrato',
        });
      }
    }

    // Validate property information
    if (contract.property) {
      if (!contract.property.address || !contract.property.city) {
        errors.push({
          field: 'propertyAddress',
          label: 'Endereço do Imóvel',
          message: 'O endereço completo do imóvel é obrigatório',
          category: 'property',
        });
      }
    }

    // Validate deposit amount
    if (contract.deposit) {
      const deposit = Number(contract.deposit);
      const rent = Number(contract.monthlyRent);
      if (deposit > rent * 3) {
        warnings.push({
          field: 'deposit',
          label: 'Valor da Caução',
          message: 'Caução superior a 3 aluguéis pode ser considerada abusiva',
          recommendation: 'Art. 38 Lei 8.245/91 - A caução não pode exceder 3 meses de aluguel',
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Quick validation check (returns boolean only)
   */
  async isContractValid(contractId: bigint): Promise<boolean> {
    const result = await this.validateContract(contractId);
    return result.valid;
  }

  /**
   * Get validation summary for display
   */
  async getValidationSummary(contractId: bigint): Promise<{
    isValid: boolean;
    score: number;
    errorCount: number;
    warningCount: number;
    categories: Record<string, { errors: number; warnings: number }>;
  }> {
    const result = await this.validateContract(contractId);

    const categories: Record<string, { errors: number; warnings: number }> = {
      financial: { errors: 0, warnings: 0 },
      temporal: { errors: 0, warnings: 0 },
      parties: { errors: 0, warnings: 0 },
      property: { errors: 0, warnings: 0 },
      legal: { errors: 0, warnings: 0 },
    };

    for (const error of result.errors) {
      if (categories[error.category]) {
        categories[error.category].errors++;
      }
    }

    for (const warning of result.warnings) {
      // Categorize warnings based on field
      const field = warning.field;
      if (field.includes('rent') || field.includes('fee') || field.includes('deposit') || field.includes('interest')) {
        categories.financial.warnings++;
      } else if (field.includes('date') || field.includes('duration')) {
        categories.temporal.warnings++;
      } else if (field.includes('tenant') || field.includes('owner')) {
        categories.parties.warnings++;
      } else if (field.includes('property')) {
        categories.property.warnings++;
      } else {
        categories.legal.warnings++;
      }
    }

    return {
      isValid: result.valid,
      score: result.score,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      categories,
    };
  }

  /**
   * Get list of valid readjustment indexes
   */
  getValidIndexes(): string[] {
    return this.validIndexes;
  }

  /**
   * Get required fields definition
   */
  getRequiredFields(): RequiredContractField[] {
    return this.requiredFields;
  }
}
