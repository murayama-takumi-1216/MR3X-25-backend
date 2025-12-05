import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { CellereService } from './integrations/cellere.service';
import { MockAnalysisService } from './services/mock-analysis.service';
import { AnalyzeTenantDto, AnalysisType, GetAnalysisHistoryDto } from './dto';
import { TenantAnalysisStatus, RiskLevel } from '@prisma/client';

@Injectable()
export class TenantAnalysisService {
  private readonly logger = new Logger(TenantAnalysisService.name);
  private readonly useMockData: boolean;
  private readonly analysisValidityDays: number;

  constructor(
    private prisma: PrismaService,
    private cellereService: CellereService,
    private mockService: MockAnalysisService,
    private configService: ConfigService,
  ) {
    // ConfigService returns strings from .env, need to parse boolean properly
    const tenantAnalysisEnabled = this.configService.get<string>('TENANT_ANALYSIS_ENABLED', 'false');
    this.useMockData = tenantAnalysisEnabled !== 'true';
    this.analysisValidityDays = this.configService.get<number>('TENANT_ANALYSIS_VALIDITY_DAYS', 30);

    if (this.useMockData) {
      this.logger.warn('Tenant Analysis is using MOCK data. Set TENANT_ANALYSIS_ENABLED=true for real API.');
    }
  }

  /**
   * Perform a full tenant analysis
   */
  async analyzeTenant(dto: AnalyzeTenantDto, userId: bigint, agencyId?: bigint) {
    const { document, analysisType = AnalysisType.FULL, name } = dto;
    const documentType = document.length === 11 ? 'CPF' : 'CNPJ';

    this.logger.log(`Starting ${analysisType} analysis for document: ${this.maskDocument(document)}`);

    // Check for recent valid analysis
    const existingAnalysis = await this.findRecentAnalysis(document);
    if (existingAnalysis) {
      this.logger.log(`Found recent valid analysis for document: ${this.maskDocument(document)}`);
      return this.formatAnalysisResponse(existingAnalysis);
    }

    // Perform analysis FIRST - don't save to DB if it fails
    let financial, background, documentValidation;

    try {
      if (analysisType === AnalysisType.FULL || analysisType === AnalysisType.FINANCIAL) {
        financial = await this.getFinancialAnalysis(document);
      }

      if (analysisType === AnalysisType.FULL || analysisType === AnalysisType.BACKGROUND) {
        background = await this.getBackgroundAnalysis(document);
      }

      if (analysisType === AnalysisType.FULL) {
        documentValidation = await this.getDocumentValidation(document);
      }
    } catch (error) {
      this.logger.error(`Analysis failed for ${this.maskDocument(document)}: ${error.message}`);

      // Extract user-friendly error message
      const errorMessage = this.extractErrorMessage(error);

      // Don't save to DB - just throw the error with clear message
      throw new Error(errorMessage);
    }

    // Calculate risk score and level
    const { riskScore, riskLevel } = this.calculateRiskScore(financial, background, documentValidation);
    const recommendation = this.getRecommendation(riskScore, riskLevel, background);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + this.analysisValidityDays);

    // Only save to DB after successful analysis
    const analysis = await this.prisma.tenantAnalysis.create({
      data: {
        document,
        documentType,
        name: documentValidation?.registrationName || name,
        requestedById: userId,
        agencyId,

        // Financial data
        creditScore: financial?.creditScore,
        totalDebts: financial?.totalDebts,
        activeDebts: financial?.activeDebts,
        hasNegativeRecords: financial?.hasNegativeRecords,
        paymentDelays: financial?.paymentDelays,
        averageDelayDays: financial?.averageDelayDays,
        financialDetails: financial?.debtDetails ? JSON.stringify(financial.debtDetails) : null,
        financialStatus: financial?.status,

        // Criminal data
        hasCriminalRecords: background?.hasCriminalRecords,
        criminalRecordsCount: background?.criminalRecords?.length || 0,
        criminalDetails: background?.criminalRecords ? JSON.stringify(background.criminalRecords) : null,
        criminalStatus: background?.hasCriminalRecords ? 'WARNING' : 'CLEAR',

        // Judicial data
        hasJudicialRecords: background?.hasJudicialRecords,
        judicialRecordsCount: background?.judicialRecords?.length || 0,
        hasEvictions: background?.hasEvictions,
        evictionsCount: background?.evictionsCount,
        judicialDetails: background?.judicialRecords ? JSON.stringify(background.judicialRecords) : null,
        judicialStatus: background?.hasEvictions ? 'CRITICAL' : (background?.hasJudicialRecords ? 'WARNING' : 'CLEAR'),

        // Protest data
        hasProtests: background?.hasProtests,
        protestsCount: background?.protestRecords?.length || 0,
        totalProtestValue: background?.totalProtestValue,
        protestDetails: background?.protestRecords ? JSON.stringify(background.protestRecords) : null,
        protestStatus: background?.hasProtests ? 'WARNING' : 'CLEAR',

        // Document validation
        documentValid: documentValidation?.documentValid,
        documentActive: documentValidation?.documentActive,
        documentOwnerMatch: documentValidation?.documentOwnerMatch,
        hasFraudAlerts: documentValidation?.hasFraudAlerts,
        documentStatus: documentValidation?.status,

        // Risk assessment
        riskScore,
        riskLevel,
        recommendation: recommendation.recommendation,
        recommendationNotes: recommendation.notes,

        // Status
        status: TenantAnalysisStatus.COMPLETED,
        analyzedAt: new Date(),
        validUntil,

        // Raw response for auditing
        rawResponse: JSON.stringify({ financial, background, documentValidation }),
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.logger.log(`Analysis completed for ${this.maskDocument(document)} - Risk: ${riskLevel} (${riskScore})`);
    return this.formatAnalysisResponse(analysis);
  }

  /**
   * Extract user-friendly error message from API errors
   */
  private extractErrorMessage(error: any): string {
    const message = error.message || 'Unknown error';

    // Map common error messages to user-friendly Portuguese messages
    if (message.includes('Insufficient Cellere credits')) {
      return 'Créditos insuficientes na API Cellere. Por favor, adicione mais créditos na sua conta.';
    }
    if (message.includes('invalidToken') || message.includes('401')) {
      return 'Token da API Cellere inválido. Por favor, verifique a configuração do token.';
    }
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return 'Tempo limite excedido ao conectar com a API. Tente novamente.';
    }
    if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
      return 'Não foi possível conectar com o serviço de análise. Verifique sua conexão.';
    }
    if (message.includes('Request failed with status code 400')) {
      return 'Documento inválido ou formato incorreto. Verifique o CPF/CNPJ informado.';
    }
    if (message.includes('Request failed with status code 404')) {
      return 'Documento não encontrado na base de dados.';
    }
    if (message.includes('Request failed with status code 500')) {
      return 'Erro interno no serviço de análise. Tente novamente mais tarde.';
    }

    // Return original message if no mapping found
    return `Erro na análise: ${message}`;
  }

  /**
   * Get analysis history with filters
   */
  async getAnalysisHistory(dto: GetAnalysisHistoryDto, userId: bigint, userRole: string, agencyId?: bigint) {
    const { document, riskLevel, status, page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    // Build where clause based on user role
    const where: any = {};

    // Role-based filtering
    if (!['CEO', 'ADMIN'].includes(userRole)) {
      if (agencyId) {
        where.agencyId = agencyId;
      } else {
        where.requestedById = userId;
      }
    }

    // Apply filters
    if (document) {
      where.document = { contains: document };
    }
    if (riskLevel) {
      where.riskLevel = riskLevel as RiskLevel;
    }
    if (status) {
      where.status = status as TenantAnalysisStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.tenantAnalysis.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.tenantAnalysis.count({ where }),
    ]);

    return {
      data: data.map(item => ({
        id: item.id.toString(),
        document: this.maskDocument(item.document),
        documentType: item.documentType,
        name: item.name,
        riskScore: item.riskScore,
        riskLevel: item.riskLevel,
        recommendation: item.recommendation,
        status: item.status,
        analyzedAt: item.analyzedAt?.toISOString(),
        requestedBy: {
          id: item.requestedBy.id.toString(),
          name: item.requestedBy.name,
          email: item.requestedBy.email,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a specific analysis by ID
   */
  async getAnalysisById(id: bigint, userId: bigint, userRole: string, agencyId?: bigint) {
    const analysis = await this.prisma.tenantAnalysis.findUnique({
      where: { id },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    // Check access permissions
    if (!['CEO', 'ADMIN'].includes(userRole)) {
      if (agencyId && analysis.agencyId !== agencyId) {
        throw new NotFoundException('Analysis not found');
      }
      if (!agencyId && analysis.requestedById !== userId) {
        throw new NotFoundException('Analysis not found');
      }
    }

    return this.formatAnalysisResponse(analysis);
  }

  /**
   * Get statistics for dashboard
   */
  async getAnalysisStats(userId: bigint, userRole: string, agencyId?: bigint) {
    const where: any = {};

    if (!['CEO', 'ADMIN'].includes(userRole)) {
      if (agencyId) {
        where.agencyId = agencyId;
      } else {
        where.requestedById = userId;
      }
    }

    const [total, byRiskLevel, byStatus, recentAnalyses] = await Promise.all([
      this.prisma.tenantAnalysis.count({ where }),
      this.prisma.tenantAnalysis.groupBy({
        by: ['riskLevel'],
        where: { ...where, riskLevel: { not: null } },
        _count: true,
      }),
      this.prisma.tenantAnalysis.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.tenantAnalysis.findMany({
        where,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          document: true,
          name: true,
          riskLevel: true,
          riskScore: true,
          analyzedAt: true,
        },
      }),
    ]);

    return {
      total,
      byRiskLevel: byRiskLevel.reduce((acc, item) => {
        acc[item.riskLevel || 'UNKNOWN'] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      recentAnalyses: recentAnalyses.map(a => ({
        id: a.id.toString(),
        document: this.maskDocument(a.document),
        name: a.name,
        riskLevel: a.riskLevel,
        riskScore: a.riskScore,
        analyzedAt: a.analyzedAt?.toISOString(),
      })),
    };
  }

  // ==================== Private Methods ====================

  private async findRecentAnalysis(document: string) {
    const analysis = await this.prisma.tenantAnalysis.findFirst({
      where: {
        document,
        status: TenantAnalysisStatus.COMPLETED,
        validUntil: { gt: new Date() },
      },
      orderBy: { analyzedAt: 'desc' },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return analysis;
  }

  private async getFinancialAnalysis(document: string) {
    if (this.useMockData) {
      return this.mockService.getFinancialAnalysis(document);
    }

    return this.cellereService.getFinancialAnalysis({
      document,
      includeScore: true,
      includeDebts: true,
      includePaymentHistory: true,
    });
  }

  private async getBackgroundAnalysis(document: string) {
    if (this.useMockData) {
      return this.mockService.getBackgroundCheck(document);
    }

    return this.cellereService.getBackgroundCheck({
      document,
      includeCriminal: true,
      includeJudicial: true,
      includeProtests: true,
    });
  }

  private async getDocumentValidation(document: string) {
    if (this.useMockData) {
      return this.mockService.getDocumentValidation(document);
    }

    // Use real Cellere API for document validation
    return this.cellereService.getDocumentValidation(document);
  }

  private calculateRiskScore(financial: any, background: any, documentValidation: any): { riskScore: number; riskLevel: RiskLevel } {
    let score = 1000; // Start with perfect score

    // Financial factors (40% weight)
    if (financial) {
      if (financial.creditScore) {
        score -= Math.max(0, (1000 - financial.creditScore) * 0.3);
      }
      if (financial.totalDebts > 0) {
        score -= Math.min(150, financial.totalDebts / 200);
      }
      if (financial.activeDebts > 0) {
        score -= financial.activeDebts * 15;
      }
      if (financial.hasNegativeRecords) {
        score -= 50;
      }
      if (financial.paymentDelays > 0) {
        score -= Math.min(100, financial.paymentDelays * 10);
      }
    }

    // Background factors (50% weight)
    if (background) {
      // Criminal records - severe impact
      if (background.hasCriminalRecords) {
        background.criminalRecords?.forEach((record: any) => {
          if (record.severity === 'HIGH') score -= 250;
          else if (record.severity === 'MEDIUM') score -= 150;
          else score -= 75;
        });
      }

      // Judicial records
      if (background.hasJudicialRecords) {
        score -= background.judicialRecords?.length * 25 || 0;
      }

      // Evictions - very severe impact
      if (background.hasEvictions) {
        score -= background.evictionsCount * 150;
      }

      // Protests
      if (background.hasProtests) {
        score -= Math.min(100, (background.protestRecords?.length || 0) * 20);
        score -= Math.min(100, (background.totalProtestValue || 0) / 500);
      }
    }

    // Document validation (10% weight)
    if (documentValidation) {
      if (!documentValidation.documentValid) {
        score -= 200;
      }
      if (!documentValidation.documentActive) {
        score -= 100;
      }
      if (documentValidation.hasFraudAlerts) {
        score -= 300;
      }
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(1000, Math.round(score)));

    // Determine risk level
    let riskLevel: RiskLevel;
    if (score >= 800) riskLevel = RiskLevel.LOW;
    else if (score >= 600) riskLevel = RiskLevel.MEDIUM;
    else if (score >= 400) riskLevel = RiskLevel.HIGH;
    else riskLevel = RiskLevel.CRITICAL;

    return { riskScore: score, riskLevel };
  }

  private getRecommendation(riskScore: number, riskLevel: RiskLevel, background: any): { recommendation: string; notes: string } {
    // Check for automatic rejection conditions
    if (background?.hasEvictions && background.evictionsCount >= 2) {
      return {
        recommendation: 'REJECTED',
        notes: 'Múltiplos históricos de despejo identificados. Recomenda-se não prosseguir com a locação.',
      };
    }

    if (background?.hasCriminalRecords) {
      const hasHighSeverity = background.criminalRecords?.some((r: any) => r.severity === 'HIGH');
      if (hasHighSeverity) {
        return {
          recommendation: 'REJECTED',
          notes: 'Registros criminais de alta gravidade identificados. Recomenda-se não prosseguir com a locação.',
        };
      }
    }

    // Score-based recommendations
    if (riskLevel === RiskLevel.LOW) {
      return {
        recommendation: 'APPROVED',
        notes: 'Perfil de baixo risco. Aprovado para locação sem restrições.',
      };
    }

    if (riskLevel === RiskLevel.MEDIUM) {
      return {
        recommendation: 'APPROVED_WITH_CAUTION',
        notes: 'Perfil de risco moderado. Aprovado com recomendação de acompanhamento.',
      };
    }

    if (riskLevel === RiskLevel.HIGH) {
      return {
        recommendation: 'REQUIRES_GUARANTOR',
        notes: 'Perfil de risco elevado. Recomenda-se exigir fiador ou seguro fiança.',
      };
    }

    return {
      recommendation: 'REJECTED',
      notes: 'Perfil de risco crítico. Recomenda-se não prosseguir com a locação.',
    };
  }

  private formatAnalysisResponse(analysis: any) {
    const riskPercentage = Math.round((analysis.riskScore || 0) / 10);

    return {
      id: analysis.id.toString(),
      document: this.maskDocument(analysis.document),
      documentType: analysis.documentType,
      name: analysis.name,

      financial: {
        creditScore: analysis.creditScore,
        totalDebts: Number(analysis.totalDebts) || 0,
        activeDebts: analysis.activeDebts || 0,
        hasNegativeRecords: analysis.hasNegativeRecords || false,
        paymentDelays: analysis.paymentDelays || 0,
        averageDelayDays: analysis.averageDelayDays || 0,
        debtDetails: analysis.financialDetails ? JSON.parse(analysis.financialDetails) : [],
        status: analysis.financialStatus || 'CLEAR',
      },

      background: {
        hasCriminalRecords: analysis.hasCriminalRecords || false,
        criminalRecords: analysis.criminalDetails ? JSON.parse(analysis.criminalDetails) : [],
        hasJudicialRecords: analysis.hasJudicialRecords || false,
        judicialRecords: analysis.judicialDetails ? JSON.parse(analysis.judicialDetails) : [],
        hasEvictions: analysis.hasEvictions || false,
        evictionsCount: analysis.evictionsCount || 0,
        hasProtests: analysis.hasProtests || false,
        protestRecords: analysis.protestDetails ? JSON.parse(analysis.protestDetails) : [],
        totalProtestValue: Number(analysis.totalProtestValue) || 0,
        status: this.getBackgroundStatus(analysis),
      },

      documentValidation: {
        documentValid: analysis.documentValid ?? true,
        documentActive: analysis.documentActive ?? true,
        documentOwnerMatch: analysis.documentOwnerMatch ?? true,
        hasFraudAlerts: analysis.hasFraudAlerts || false,
        registrationName: analysis.name,
        status: analysis.documentStatus || 'VALID',
      },

      riskScore: analysis.riskScore || 0,
      riskLevel: analysis.riskLevel || 'MEDIUM',
      riskPercentage,
      recommendation: analysis.recommendation || 'REQUIRES_GUARANTOR',
      recommendationNotes: analysis.recommendationNotes,

      status: analysis.status,
      analyzedAt: analysis.analyzedAt?.toISOString(),
      validUntil: analysis.validUntil?.toISOString(),

      summary: {
        financialStatus: analysis.financialStatus || 'CLEAR',
        criminalStatus: analysis.criminalStatus || 'CLEAR',
        judicialStatus: analysis.judicialStatus || 'CLEAR',
        protestStatus: analysis.protestStatus || 'CLEAR',
        documentStatus: analysis.documentStatus || 'VALID',
      },

      requestedBy: analysis.requestedBy ? {
        id: analysis.requestedBy.id.toString(),
        name: analysis.requestedBy.name,
        email: analysis.requestedBy.email,
      } : undefined,
    };
  }

  private getBackgroundStatus(analysis: any): 'CLEAR' | 'WARNING' | 'CRITICAL' {
    if (analysis.hasCriminalRecords || analysis.hasEvictions) {
      return 'CRITICAL';
    }
    if (analysis.hasJudicialRecords || analysis.hasProtests) {
      return 'WARNING';
    }
    return 'CLEAR';
  }

  private maskDocument(document: string): string {
    if (!document) return '';
    if (document.length === 11) {
      // CPF: show first 3 and last 2 digits
      return `${document.slice(0, 3)}.***.***-${document.slice(-2)}`;
    }
    // CNPJ: show first 2 and last 2 digits
    return `${document.slice(0, 2)}.***.***/${document.slice(-6, -2)}-${document.slice(-2)}`;
  }

  // Legacy methods for backward compatibility
  async analyzeFinancial(document: string) {
    return this.getFinancialAnalysis(document);
  }

  async analyzeBackground(document: string) {
    return this.getBackgroundAnalysis(document);
  }

  async getFullAnalysis(document: string) {
    // This is the legacy method - create a simple DTO and call the new method
    const dto: AnalyzeTenantDto = { document, analysisType: AnalysisType.FULL };
    // Note: This will need a userId in production - for legacy support, we'll use a system user
    return this.analyzeTenant(dto, BigInt(1));
  }

  async healthCheck() {
    if (this.useMockData) {
      return {
        status: 'healthy',
        mode: 'mock',
        service: 'Mock Analysis Service',
        timestamp: new Date().toISOString(),
      };
    }

    const isHealthy = await this.cellereService.healthCheck();
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      mode: 'live',
      service: 'Cellere API',
      timestamp: new Date().toISOString(),
    };
  }
}
