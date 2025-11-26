import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface FinancialAnalysisRequest {
  document: string;
  includeScore?: boolean;
  includeDebts?: boolean;
  includePaymentHistory?: boolean;
}

export interface FinancialAnalysisResponse {
  creditScore?: number;
  totalDebts?: number;
  activeDebts?: number;
  debtDetails?: Array<{
    creditor: string;
    amount: number;
    daysOverdue: number;
  }>;
  paymentHistory?: {
    totalDelays: number;
    averageDelay: number;
  };
}

export interface BackgroundCheckRequest {
  document: string;
  includeCriminal?: boolean;
  includeJudicial?: boolean;
  includeProtests?: boolean;
}

export interface BackgroundCheckResponse {
  criminalRecords?: Array<{
    type: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  judicialRecords?: Array<{
    processNumber: string;
    court: string;
    type: string;
    status: string;
  }>;
  protestRecords?: Array<{
    notaryOffice: string;
    amount: number;
    creditor: string;
    status: string;
  }>;
}

@Injectable()
export class CellereService {
  private readonly logger = new Logger(CellereService.name);
  private readonly client: AxiosInstance;
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('CELLERE_API_TOKEN');
    const baseURL = this.configService.get<string>('CELLERE_API_BASE_URL', 'https://api.gw.cellereit.com.br');
    this.isEnabled = this.configService.get<boolean>('TENANT_ANALYSIS_ENABLED', false);

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug(`Cellere API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Cellere API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`Cellere API Response: ${response.status}`);
        return response;
      },
      (error) => {
        this.logger.error('Cellere API Response Error:', error.response?.status, error.message);
        return Promise.reject(error);
      }
    );
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.warn('Tenant analysis is disabled');
      return false;
    }

    try {
      // Simple health check - try to reach the API
      await this.client.get('/health', { timeout: 5000 });
      return true;
    } catch (error) {
      // If health endpoint doesn't exist, try another approach
      try {
        await this.client.options('/');
        return true;
      } catch {
        return false;
      }
    }
  }

  async getFinancialAnalysis(request: FinancialAnalysisRequest): Promise<FinancialAnalysisResponse> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    try {
      const response = await this.client.post('/consultas/financeiro', {
        documento: request.document,
        incluirScore: request.includeScore ?? true,
        incluirDividas: request.includeDebts ?? true,
        incluirHistorico: request.includePaymentHistory ?? true,
      });

      return this.mapFinancialResponse(response.data);
    } catch (error: any) {
      this.logger.error('Financial analysis failed:', error.message);
      throw new Error(`Financial analysis failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getBackgroundCheck(request: BackgroundCheckRequest): Promise<BackgroundCheckResponse> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    try {
      const response = await this.client.post('/consultas/antecedentes', {
        documento: request.document,
        incluirCriminal: request.includeCriminal ?? true,
        incluirJudicial: request.includeJudicial ?? true,
        incluirProtestos: request.includeProtests ?? true,
      });

      return this.mapBackgroundResponse(response.data);
    } catch (error: any) {
      this.logger.error('Background check failed:', error.message);
      throw new Error(`Background check failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getDocumentExtraction(imageBase64: string): Promise<any> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    try {
      const response = await this.client.post('/contextus/extract', {
        imagem: imageBase64,
      });

      return response.data;
    } catch (error: any) {
      this.logger.error('Document extraction failed:', error.message);
      throw new Error(`Document extraction failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getFacematch(selfieBase64: string, documentBase64: string): Promise<{ match: boolean; confidence: number }> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    try {
      const response = await this.client.post('/facematch/compare', {
        selfie: selfieBase64,
        documento: documentBase64,
      });

      return {
        match: response.data.match ?? false,
        confidence: response.data.confianca ?? 0,
      };
    } catch (error: any) {
      this.logger.error('Facematch failed:', error.message);
      throw new Error(`Facematch failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async validatePhone(phone: string): Promise<{ valid: boolean; carrier?: string; type?: string }> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    try {
      const response = await this.client.post('/telecom/validate', {
        telefone: phone,
      });

      return {
        valid: response.data.valido ?? false,
        carrier: response.data.operadora,
        type: response.data.tipo,
      };
    } catch (error: any) {
      this.logger.error('Phone validation failed:', error.message);
      throw new Error(`Phone validation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  private mapFinancialResponse(data: any): FinancialAnalysisResponse {
    return {
      creditScore: data.score ?? data.creditScore ?? data.pontuacao,
      totalDebts: data.totalDividas ?? data.totalDebts ?? 0,
      activeDebts: data.dividasAtivas ?? data.activeDebts ?? 0,
      debtDetails: data.detalheDividas?.map((d: any) => ({
        creditor: d.credor ?? d.creditor,
        amount: d.valor ?? d.amount,
        daysOverdue: d.diasAtraso ?? d.daysOverdue ?? 0,
      })) ?? [],
      paymentHistory: data.historicoPagamento ? {
        totalDelays: data.historicoPagamento.totalAtrasos ?? 0,
        averageDelay: data.historicoPagamento.mediaAtraso ?? 0,
      } : undefined,
    };
  }

  private mapBackgroundResponse(data: any): BackgroundCheckResponse {
    return {
      criminalRecords: data.registrosCriminais?.map((r: any) => ({
        type: r.tipo ?? r.type,
        description: r.descricao ?? r.description,
        severity: this.mapSeverity(r.gravidade ?? r.severity),
      })) ?? [],
      judicialRecords: data.registrosJudiciais?.map((r: any) => ({
        processNumber: r.numeroProcesso ?? r.processNumber,
        court: r.tribunal ?? r.court,
        type: r.tipo ?? r.type,
        status: r.status,
      })) ?? [],
      protestRecords: data.protestos?.map((p: any) => ({
        notaryOffice: p.cartorio ?? p.notaryOffice,
        amount: p.valor ?? p.amount,
        creditor: p.credor ?? p.creditor,
        status: p.status,
      })) ?? [],
    };
  }

  private mapSeverity(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const normalized = severity?.toUpperCase();
    if (normalized === 'BAIXA' || normalized === 'LOW') return 'LOW';
    if (normalized === 'MEDIA' || normalized === 'MEDIUM') return 'MEDIUM';
    if (normalized === 'ALTA' || normalized === 'HIGH') return 'HIGH';
    return 'LOW';
  }
}
