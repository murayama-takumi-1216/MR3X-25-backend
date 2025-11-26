import { Injectable } from '@nestjs/common';
import {
  validateCPF,
  validateCNPJ,
  validateDocument,
  formatCPF,
  formatCNPJ,
  ValidationResult,
} from '../../common/utils/cpf-cnpj-validator';
import axios from 'axios';

@Injectable()
export class ValidationService {
  validateCPF(cpf: string): ValidationResult {
    return validateCPF(cpf);
  }

  validateCNPJ(cnpj: string): ValidationResult {
    return validateCNPJ(cnpj);
  }

  validateDocument(document: string): ValidationResult {
    return validateDocument(document);
  }

  formatCPF(cpf: string): string {
    return formatCPF(cpf);
  }

  formatCNPJ(cnpj: string): string {
    return formatCNPJ(cnpj);
  }

  async validateCEP(cep: string): Promise<{ isValid: boolean; data?: any; error?: string }> {
    const cleanedCep = cep.replace(/\D/g, '');

    if (cleanedCep.length !== 8) {
      return { isValid: false, error: 'CEP must have 8 digits' };
    }

    try {
      const response = await axios.get(`https://viacep.com.br/ws/${cleanedCep}/json/`);

      if (response.data.erro) {
        return { isValid: false, error: 'CEP not found' };
      }

      return {
        isValid: true,
        data: {
          cep: response.data.cep,
          street: response.data.logradouro,
          complement: response.data.complemento,
          neighborhood: response.data.bairro,
          city: response.data.localidade,
          state: response.data.uf,
          ibge: response.data.ibge,
        },
      };
    } catch (error) {
      return { isValid: false, error: 'Failed to fetch CEP data' };
    }
  }

  formatCEP(cep: string): string {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) return cep;
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
}
