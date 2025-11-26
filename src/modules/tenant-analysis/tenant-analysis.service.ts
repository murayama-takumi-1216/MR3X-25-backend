import { Injectable } from '@nestjs/common';
import { CellereService } from './integrations/cellere.service';

@Injectable()
export class TenantAnalysisService {
  constructor(private cellereService: CellereService) {}

  async analyzeFinancial(document: string) {
    return this.cellereService.getFinancialAnalysis({
      document,
      includeScore: true,
      includeDebts: true,
      includePaymentHistory: true,
    });
  }

  async analyzeBackground(document: string) {
    return this.cellereService.getBackgroundCheck({
      document,
      includeCriminal: true,
      includeJudicial: true,
      includeProtests: true,
    });
  }

  async getFullAnalysis(document: string) {
    const [financial, background] = await Promise.all([
      this.analyzeFinancial(document),
      this.analyzeBackground(document),
    ]);

    const riskScore = this.calculateRiskScore(financial, background);

    return {
      document,
      financial,
      background,
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      analyzedAt: new Date().toISOString(),
    };
  }

  private calculateRiskScore(financial: any, background: any): number {
    let score = 1000; // Start with perfect score

    // Financial factors (40% weight)
    if (financial.creditScore) {
      score -= Math.max(0, (1000 - financial.creditScore) * 0.4);
    }

    if (financial.totalDebts > 0) {
      score -= Math.min(200, financial.totalDebts / 100);
    }

    if (financial.activeDebts > 0) {
      score -= financial.activeDebts * 20;
    }

    // Background factors (60% weight)
    if (background.criminalRecords?.length > 0) {
      background.criminalRecords.forEach((record: any) => {
        if (record.severity === 'HIGH') score -= 200;
        else if (record.severity === 'MEDIUM') score -= 100;
        else score -= 50;
      });
    }

    if (background.judicialRecords?.length > 0) {
      score -= background.judicialRecords.length * 30;
    }

    if (background.protestRecords?.length > 0) {
      score -= background.protestRecords.length * 25;
    }

    return Math.max(0, Math.min(1000, Math.round(score)));
  }

  private getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 800) return 'LOW';
    if (score >= 600) return 'MEDIUM';
    if (score >= 400) return 'HIGH';
    return 'CRITICAL';
  }

  async healthCheck() {
    const isHealthy = await this.cellereService.healthCheck();
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'Cellere API',
      timestamp: new Date().toISOString(),
    };
  }
}
