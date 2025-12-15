import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, Matches, Length, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export enum DocumentType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
}

export enum AnalysisType {
  FULL = 'FULL',
  FINANCIAL = 'FINANCIAL',
  BACKGROUND = 'BACKGROUND',
  QUICK = 'QUICK',
}

export class AnalyzeTenantDto {
  @ApiProperty({
    description: 'CPF or CNPJ of the tenant',
    example: '12345678901'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{11}$|^[0-9]{14}$/, {
    message: 'Document must be a valid CPF (11 digits) or CNPJ (14 digits)'
  })
  document: string;

  @ApiPropertyOptional({
    description: 'Type of analysis to perform',
    enum: AnalysisType,
    default: AnalysisType.FULL
  })
  @IsOptional()
  @IsEnum(AnalysisType)
  analysisType?: AnalysisType = AnalysisType.FULL;

  @ApiPropertyOptional({
    description: 'Name of the tenant (optional, for reference)',
    example: 'João da Silva'
  })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  name?: string;

  @ApiProperty({
    description: 'LGPD disclaimer acceptance (required)',
    example: true
  })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'lgpdAccepted deve ser um valor booleano' })
  @IsNotEmpty({ message: 'Você deve aceitar os termos da LGPD para continuar' })
  lgpdAccepted: boolean;
}

export class GetAnalysisHistoryDto {
  @ApiPropertyOptional({ description: 'Filter by document' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ description: 'Filter by risk level' })
  @IsOptional()
  @IsString()
  riskLevel?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  limit?: number = 10;
}
