import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DebtDetailDto {
  @ApiProperty()
  creditor: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  daysOverdue: number;

  @ApiPropertyOptional()
  type?: string;
}

export class FinancialAnalysisDto {
  @ApiProperty({ description: 'Credit score from 0 to 1000' })
  creditScore: number;

  @ApiProperty()
  totalDebts: number;

  @ApiProperty()
  activeDebts: number;

  @ApiProperty()
  hasNegativeRecords: boolean;

  @ApiPropertyOptional()
  paymentDelays?: number;

  @ApiPropertyOptional()
  averageDelayDays?: number;

  @ApiProperty({ type: [DebtDetailDto] })
  debtDetails: DebtDetailDto[];

  @ApiProperty({ enum: ['CLEAR', 'WARNING', 'CRITICAL'] })
  status: 'CLEAR' | 'WARNING' | 'CRITICAL';
}

export class CriminalRecordDto {
  @ApiProperty()
  type: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  severity: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiPropertyOptional()
  date?: string;
}

export class JudicialRecordDto {
  @ApiProperty()
  processNumber: string;

  @ApiProperty()
  court: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  isEviction?: boolean;
}

export class ProtestRecordDto {
  @ApiProperty()
  notaryOffice: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  creditor: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  date?: string;
}

export class BackgroundCheckDto {
  @ApiProperty()
  hasCriminalRecords: boolean;

  @ApiProperty({ type: [CriminalRecordDto] })
  criminalRecords: CriminalRecordDto[];

  @ApiProperty()
  hasJudicialRecords: boolean;

  @ApiProperty({ type: [JudicialRecordDto] })
  judicialRecords: JudicialRecordDto[];

  @ApiProperty()
  hasEvictions: boolean;

  @ApiProperty()
  evictionsCount: number;

  @ApiProperty()
  hasProtests: boolean;

  @ApiProperty({ type: [ProtestRecordDto] })
  protestRecords: ProtestRecordDto[];

  @ApiProperty()
  totalProtestValue: number;

  @ApiProperty({ enum: ['CLEAR', 'WARNING', 'CRITICAL'] })
  status: 'CLEAR' | 'WARNING' | 'CRITICAL';
}

export class DocumentValidationDto {
  @ApiProperty()
  documentValid: boolean;

  @ApiProperty()
  documentActive: boolean;

  @ApiProperty()
  documentOwnerMatch: boolean;

  @ApiProperty()
  hasFraudAlerts: boolean;

  @ApiPropertyOptional()
  registrationName?: string;

  @ApiProperty({ enum: ['VALID', 'INVALID', 'WARNING'] })
  status: 'VALID' | 'INVALID' | 'WARNING';
}

export class TenantAnalysisResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  document: string;

  @ApiProperty({ enum: ['CPF', 'CNPJ'] })
  documentType: 'CPF' | 'CNPJ';

  @ApiPropertyOptional()
  name?: string;

  @ApiProperty({ type: FinancialAnalysisDto })
  financial: FinancialAnalysisDto;

  @ApiProperty({ type: BackgroundCheckDto })
  background: BackgroundCheckDto;

  @ApiProperty({ type: DocumentValidationDto })
  documentValidation: DocumentValidationDto;

  @ApiProperty({ description: 'Risk score from 0 (worst) to 1000 (best)' })
  riskScore: number;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({ description: 'Risk score as percentage (0-100)' })
  riskPercentage: number;

  @ApiProperty({ enum: ['APPROVED', 'APPROVED_WITH_CAUTION', 'REQUIRES_GUARANTOR', 'REJECTED'] })
  recommendation: 'APPROVED' | 'APPROVED_WITH_CAUTION' | 'REQUIRES_GUARANTOR' | 'REJECTED';

  @ApiPropertyOptional()
  recommendationNotes?: string;

  @ApiProperty({ enum: ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'] })
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

  @ApiProperty()
  analyzedAt: string;

  @ApiPropertyOptional()
  validUntil?: string;

  @ApiProperty({
    description: 'Summary of the analysis',
    example: {
      financialStatus: 'CLEAR',
      criminalStatus: 'CLEAR',
      judicialStatus: 'WARNING',
      protestStatus: 'CLEAR',
      documentStatus: 'VALID'
    }
  })
  summary: {
    financialStatus: string;
    criminalStatus: string;
    judicialStatus: string;
    protestStatus: string;
    documentStatus: string;
  };
}

export class AnalysisHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  document: string;

  @ApiProperty()
  documentType: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiProperty()
  riskScore: number;

  @ApiProperty()
  riskLevel: string;

  @ApiProperty()
  recommendation: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  analyzedAt: string;

  @ApiProperty()
  requestedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export class AnalysisHistoryResponseDto {
  @ApiProperty({ type: [AnalysisHistoryItemDto] })
  data: AnalysisHistoryItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
