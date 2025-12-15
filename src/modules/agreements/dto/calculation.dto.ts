import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, IsArray } from 'class-validator';

export class CalculateDebtDto {
  @ApiPropertyOptional({ description: 'Custom calculation date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  calculationDate?: string;
}

export class SimulateDebtDto {
  @ApiProperty({ description: 'Base value (original invoice amount)' })
  @IsNumber()
  baseValue: number;

  @ApiProperty({ description: 'Due date of the invoice' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Calculation date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  calculationDate?: string;

  @ApiPropertyOptional({ description: 'Readjustment index (IGPM, IPCA, INPC, SELIC, CDI)', default: 'IGPM' })
  @IsOptional()
  @IsString()
  readjustmentIndex?: string;

  @ApiPropertyOptional({ description: 'Penalty percent (single charge)', default: 2 })
  @IsOptional()
  @IsNumber()
  penaltyPercent?: number;

  @ApiPropertyOptional({ description: 'Monthly interest percent', default: 1 })
  @IsOptional()
  @IsNumber()
  monthlyInterestPercent?: number;
}

export class AcceptSettlementDto {
  @ApiProperty({ description: 'Invoice ID' })
  @IsString()
  invoiceId: string;

  @ApiProperty({ description: 'Selected settlement option ID (ONE_TIME, TWO_INSTALLMENTS, etc.)' })
  @IsString()
  optionId: string;
}

export class CalculateMultipleDebtsDto {
  @ApiProperty({ description: 'Array of invoice IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  invoiceIds: string[];

  @ApiPropertyOptional({ description: 'Custom calculation date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  calculationDate?: string;
}

export class DebtCalculationResponseDto {
  @ApiProperty() invoiceId: string;
  @ApiProperty() contractId: string;
  @ApiProperty() baseValue: number;
  @ApiProperty() dueDate: string;
  @ApiProperty() calculationDate: string;
  @ApiProperty() daysOverdue: number;
  @ApiProperty() readjustmentIndex: string;
  @ApiProperty() monthlyIndexRate: number;
  @ApiProperty() penaltyPercent: number;
  @ApiProperty() monthlyInterestPercent: number;
  @ApiProperty() correctionFactor: number;
  @ApiProperty() correctedValue: number;
  @ApiProperty() penaltyAmount: number;
  @ApiProperty() interestAmount: number;
  @ApiProperty() grossTotal: number;
  @ApiProperty() nextRecalculationAt: string;
}

export class SettlementOptionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty() installments: number;
  @ApiProperty() originalPenalty: number;
  @ApiProperty() originalInterest: number;
  @ApiProperty() interestDiscountPercent: number;
  @ApiProperty() penaltyDiscountPercent: number;
  @ApiProperty() penaltyAfterDiscount: number;
  @ApiProperty() interestAfterDiscount: number;
  @ApiProperty() installmentFeePercent: number;
  @ApiProperty() installmentFeeAmount: number;
  @ApiProperty() finalTotal: number;
  @ApiProperty() installmentValue: number;
  @ApiProperty() totalSavings: number;
}

export class SettlementOptionsResponseDto {
  @ApiProperty({ type: DebtCalculationResponseDto })
  debt: DebtCalculationResponseDto;

  @ApiProperty({ type: [SettlementOptionResponseDto] })
  options: SettlementOptionResponseDto[];

  @ApiProperty({ description: 'When these calculated values expire (next midnight)' })
  expiresAt: string;
}
