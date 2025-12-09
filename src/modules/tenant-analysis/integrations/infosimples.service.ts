import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * InfoSimples CENPROT-SP Protestos API Response Interfaces
 */
export interface InfoSimplesProtestData {
  cartorio: string;
  cidade: string;
  uf: string;
  data_protesto?: string;
  valor?: number;
  protocolo?: string;
  apresentante?: string;
  cedente?: string;
  especie?: string;
}

export interface InfoSimplesCartorio {
  nome: string;
  cidade: string;
  uf: string;
  endereco?: string;
  telefone?: string;
  protestos: InfoSimplesProtestData[];
  quantidade_protestos: number;
}

export interface InfoSimplesResponse {
  code: number;
  code_message: string;
  data: {
    documento_pesquisado: string;
    protocolo_consulta: string;
    quantidade_titulos: number;
    retornou_todos_os_protestos_do_site: boolean;
    cartorios: InfoSimplesCartorio[];
    data_consulta?: string;
  }[];
  errors: string[];
  site_receipts?: {
    site_name: string;
    site_url: string;
    message?: string;
  }[];
}

export interface ProtestAnalysisResult {
  hasProtests: boolean;
  totalProtests: number;
  totalValue: number;
  protests: Array<{
    notaryOffice: string;
    city: string;
    state: string;
    date?: string;
    amount?: number;
    protocol?: string;
    presenter?: string;
    assignor?: string;
    type?: string;
  }>;
  cartoriosWithProtests: number;
  consultationProtocol?: string;
  consultationDate?: string;
  source: 'INFOSIMPLES_CENPROT_SP';
  rawResponse?: any;
}

@Injectable()
export class InfoSimplesService {
  private readonly logger = new Logger(InfoSimplesService.name);
  private readonly client: AxiosInstance;
  private readonly isEnabled: boolean;
  private readonly apiToken: string;

  // InfoSimples API endpoints
  private readonly BASE_URL = 'https://api.infosimples.com/api/v2/consultas';
  private readonly CENPROT_SP_ENDPOINT = '/cenprot-sp/protestos';
  private readonly IEPTB_ENDPOINT = '/ieptb/protestos';
  private readonly IEPTB_CENPROT_SP_ENDPOINT = '/ieptb-cenprotsp/protestos';

  constructor(private configService: ConfigService) {
    this.apiToken = this.configService.get<string>('INFOSIMPLES_API_TOKEN', '');
    this.isEnabled = this.configService.get<string>('INFOSIMPLES_ENABLED', 'false') === 'true';

    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 60000, // 60 seconds - external API can be slow
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.log(`InfoSimples API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('InfoSimples API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.logger.log(`InfoSimples API Response: ${response.status} - Code: ${response.data?.code}`);
        return response;
      },
      (error) => {
        this.logger.error(`InfoSimples API Error: ${error.response?.status} - ${error.message}`);
        if (error.response?.data) {
          this.logger.error(`Error data: ${JSON.stringify(error.response.data)}`);
        }
        return Promise.reject(error);
      }
    );

    if (this.isEnabled) {
      this.logger.log('InfoSimples API enabled');
    } else {
      this.logger.warn('InfoSimples API is disabled. Set INFOSIMPLES_ENABLED=true to enable.');
    }
  }

  /**
   * Check if the service is enabled
   */
  isServiceEnabled(): boolean {
    return this.isEnabled && !!this.apiToken;
  }

  /**
   * Get protest data from CENPROT-SP (São Paulo Central de Protestos)
   * This endpoint provides detailed protest information for São Paulo state
   */
  async getProtestsCenprotSP(document: string): Promise<ProtestAnalysisResult> {
    if (!this.isServiceEnabled()) {
      this.logger.warn('InfoSimples service is not enabled, returning empty result');
      return this.getEmptyResult();
    }

    const isCPF = document.length === 11;
    const cleanDocument = document.replace(/\D/g, '');

    this.logger.log(`Querying CENPROT-SP protests for ${isCPF ? 'CPF' : 'CNPJ'}: ${this.maskDocument(cleanDocument)}`);

    try {
      const response = await this.client.post<InfoSimplesResponse>(this.CENPROT_SP_ENDPOINT, null, {
        params: {
          token: this.apiToken,
          [isCPF ? 'cpf' : 'cnpj']: cleanDocument,
          timeout: 300, // 5 minutes timeout for the query
        },
      });

      return this.mapResponse(response.data, 'CENPROT_SP');
    } catch (error: any) {
      this.logger.error(`CENPROT-SP query failed: ${error.message}`);

      if (error.response?.data?.code === 600) {
        // Token error
        throw new Error('InfoSimples API token inválido ou expirado');
      }

      if (error.response?.data?.code >= 600) {
        throw new Error(`InfoSimples API error: ${error.response.data.code_message || error.message}`);
      }

      throw error;
    }
  }

  /**
   * Get protest data from IEPTB Nacional
   * This provides nationwide protest information but with less detail for SP
   */
  async getProtestsIEPTB(
    document: string,
    credentials?: { loginCpf: string; loginSenha: string }
  ): Promise<ProtestAnalysisResult> {
    if (!this.isServiceEnabled()) {
      this.logger.warn('InfoSimples service is not enabled, returning empty result');
      return this.getEmptyResult();
    }

    const isCPF = document.length === 11;
    const cleanDocument = document.replace(/\D/g, '');

    this.logger.log(`Querying IEPTB protests for ${isCPF ? 'CPF' : 'CNPJ'}: ${this.maskDocument(cleanDocument)}`);

    try {
      const params: any = {
        token: this.apiToken,
        [isCPF ? 'cpf' : 'cnpj']: cleanDocument,
        timeout: 300,
      };

      // Add credentials if provided (required for GOV.BR login)
      if (credentials) {
        params.login_cpf = credentials.loginCpf;
        params.login_senha = credentials.loginSenha;
      }

      const response = await this.client.post<InfoSimplesResponse>(this.IEPTB_ENDPOINT, null, {
        params,
      });

      return this.mapResponse(response.data, 'IEPTB');
    } catch (error: any) {
      this.logger.error(`IEPTB query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get combined protest data from IEPTB + CENPROT-SP
   * This provides the most comprehensive protest information
   */
  async getProtestsCombined(document: string): Promise<ProtestAnalysisResult> {
    if (!this.isServiceEnabled()) {
      this.logger.warn('InfoSimples service is not enabled, returning empty result');
      return this.getEmptyResult();
    }

    const isCPF = document.length === 11;
    const cleanDocument = document.replace(/\D/g, '');

    this.logger.log(`Querying combined IEPTB/CENPROT-SP protests for ${isCPF ? 'CPF' : 'CNPJ'}: ${this.maskDocument(cleanDocument)}`);

    try {
      const response = await this.client.post<InfoSimplesResponse>(this.IEPTB_CENPROT_SP_ENDPOINT, null, {
        params: {
          token: this.apiToken,
          [isCPF ? 'cpf' : 'cnpj']: cleanDocument,
          timeout: 300,
        },
      });

      return this.mapResponse(response.data, 'IEPTB_CENPROT_SP');
    } catch (error: any) {
      this.logger.error(`Combined query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main method to get protest analysis - tries CENPROT-SP first, falls back to mock if disabled
   */
  async analyzeProtests(document: string): Promise<ProtestAnalysisResult> {
    if (!this.isServiceEnabled()) {
      this.logger.warn('InfoSimples not enabled, returning mock data');
      return this.getMockProtestData(document);
    }

    try {
      // Use CENPROT-SP for São Paulo detailed data
      return await this.getProtestsCenprotSP(document);
    } catch (error: any) {
      this.logger.error(`Protest analysis failed: ${error.message}`);

      // Return empty result on error instead of throwing
      return {
        ...this.getEmptyResult(),
        rawResponse: { error: error.message },
      };
    }
  }

  /**
   * Map InfoSimples API response to our internal format
   */
  private mapResponse(response: InfoSimplesResponse, source: string): ProtestAnalysisResult {
    // Check for successful response (200 = success with data, 201 = success with multiple results)
    if (response.code !== 200 && response.code !== 201) {
      this.logger.warn(`InfoSimples returned code ${response.code}: ${response.code_message}`);

      // Code 404 typically means no data found
      if (response.code === 404) {
        return this.getEmptyResult();
      }

      throw new Error(`InfoSimples error: ${response.code_message}`);
    }

    const data = response.data?.[0];
    if (!data) {
      return this.getEmptyResult();
    }

    const protests: ProtestAnalysisResult['protests'] = [];
    let totalValue = 0;

    // Process each cartório
    for (const cartorio of data.cartorios || []) {
      for (const protesto of cartorio.protestos || []) {
        const amount = this.parseValue(protesto.valor);
        totalValue += amount;

        protests.push({
          notaryOffice: cartorio.nome || protesto.cartorio,
          city: cartorio.cidade || protesto.cidade,
          state: cartorio.uf || protesto.uf,
          date: protesto.data_protesto,
          amount,
          protocol: protesto.protocolo,
          presenter: protesto.apresentante,
          assignor: protesto.cedente,
          type: protesto.especie,
        });
      }
    }

    return {
      hasProtests: data.quantidade_titulos > 0 || protests.length > 0,
      totalProtests: data.quantidade_titulos || protests.length,
      totalValue,
      protests,
      cartoriosWithProtests: (data.cartorios || []).filter(c => c.quantidade_protestos > 0).length,
      consultationProtocol: data.protocolo_consulta,
      consultationDate: data.data_consulta,
      source: `INFOSIMPLES_${source}` as any,
      rawResponse: response,
    };
  }

  /**
   * Parse monetary value from various formats
   */
  private parseValue(value: any): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;

    // Handle Brazilian currency format (1.234,56)
    const cleanValue = String(value)
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');

    return parseFloat(cleanValue) || 0;
  }

  /**
   * Get empty result structure
   */
  private getEmptyResult(): ProtestAnalysisResult {
    return {
      hasProtests: false,
      totalProtests: 0,
      totalValue: 0,
      protests: [],
      cartoriosWithProtests: 0,
      source: 'INFOSIMPLES_CENPROT_SP',
    };
  }

  /**
   * Generate mock protest data for testing/development
   */
  private getMockProtestData(document: string): ProtestAnalysisResult {
    // Use document hash to generate consistent mock data
    const hash = document.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const scenario = hash % 4;

    switch (scenario) {
      case 0:
        // No protests
        return this.getEmptyResult();

      case 1:
        // One small protest
        return {
          hasProtests: true,
          totalProtests: 1,
          totalValue: 1500.00,
          protests: [{
            notaryOffice: '1º Tabelião de Protestos de São Paulo',
            city: 'São Paulo',
            state: 'SP',
            date: '2024-06-15',
            amount: 1500.00,
            protocol: 'MOCK-001',
            presenter: 'Empresa XYZ Ltda',
            assignor: 'Banco ABC S.A.',
            type: 'Duplicata',
          }],
          cartoriosWithProtests: 1,
          consultationProtocol: 'MOCK-PROTOCOL-001',
          consultationDate: new Date().toISOString(),
          source: 'INFOSIMPLES_CENPROT_SP',
        };

      case 2:
        // Multiple protests
        return {
          hasProtests: true,
          totalProtests: 3,
          totalValue: 8750.00,
          protests: [
            {
              notaryOffice: '2º Tabelião de Protestos de São Paulo',
              city: 'São Paulo',
              state: 'SP',
              date: '2024-03-10',
              amount: 3500.00,
              protocol: 'MOCK-002',
              presenter: 'Comércio ABC',
              type: 'Cheque',
            },
            {
              notaryOffice: '5º Tabelião de Protestos de São Paulo',
              city: 'São Paulo',
              state: 'SP',
              date: '2024-05-20',
              amount: 2250.00,
              protocol: 'MOCK-003',
              presenter: 'Serviços XYZ',
              type: 'Duplicata',
            },
            {
              notaryOffice: '1º Tabelião de Protestos de Campinas',
              city: 'Campinas',
              state: 'SP',
              date: '2024-07-01',
              amount: 3000.00,
              protocol: 'MOCK-004',
              presenter: 'Fornecedor QRS',
              type: 'Nota Promissória',
            },
          ],
          cartoriosWithProtests: 3,
          consultationProtocol: 'MOCK-PROTOCOL-002',
          consultationDate: new Date().toISOString(),
          source: 'INFOSIMPLES_CENPROT_SP',
        };

      default:
        // Critical - many protests
        return {
          hasProtests: true,
          totalProtests: 7,
          totalValue: 45000.00,
          protests: [
            {
              notaryOffice: '1º Tabelião de Protestos de São Paulo',
              city: 'São Paulo',
              state: 'SP',
              date: '2023-11-15',
              amount: 12000.00,
              protocol: 'MOCK-010',
              presenter: 'Banco Central',
              type: 'Cédula de Crédito',
            },
            {
              notaryOffice: '3º Tabelião de Protestos de São Paulo',
              city: 'São Paulo',
              state: 'SP',
              date: '2024-01-20',
              amount: 8500.00,
              protocol: 'MOCK-011',
              type: 'Duplicata',
            },
            {
              notaryOffice: '7º Tabelião de Protestos de São Paulo',
              city: 'São Paulo',
              state: 'SP',
              date: '2024-02-10',
              amount: 15000.00,
              protocol: 'MOCK-012',
              type: 'Contrato',
            },
            {
              notaryOffice: '2º Tabelião de Protestos de Guarulhos',
              city: 'Guarulhos',
              state: 'SP',
              date: '2024-04-05',
              amount: 5000.00,
              protocol: 'MOCK-013',
              type: 'Cheque',
            },
            {
              notaryOffice: '1º Tabelião de Protestos de Santos',
              city: 'Santos',
              state: 'SP',
              date: '2024-05-15',
              amount: 4500.00,
              protocol: 'MOCK-014',
              type: 'Nota Promissória',
            },
          ],
          cartoriosWithProtests: 5,
          consultationProtocol: 'MOCK-PROTOCOL-003',
          consultationDate: new Date().toISOString(),
          source: 'INFOSIMPLES_CENPROT_SP',
        };
    }
  }

  /**
   * Mask document for logging
   */
  private maskDocument(document: string): string {
    if (!document) return '';
    if (document.length === 11) {
      return `${document.slice(0, 3)}.***.***-${document.slice(-2)}`;
    }
    return `${document.slice(0, 2)}.***.***/${document.slice(-6, -2)}-${document.slice(-2)}`;
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ enabled: boolean; hasToken: boolean; status: string }> {
    return {
      enabled: this.isEnabled,
      hasToken: !!this.apiToken,
      status: this.isServiceEnabled() ? 'ready' : 'disabled',
    };
  }
}
