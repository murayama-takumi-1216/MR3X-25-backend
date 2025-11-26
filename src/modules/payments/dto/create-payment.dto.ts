import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsEnum, IsOptional } from 'class-validator';

export enum PaymentType {
  ALUGUEL = 'ALUGUEL',
  CONDOMINIO = 'CONDOMINIO',
  IPTU = 'IPTU',
  OUTROS = 'OUTROS',
}

export class CreatePaymentDto {
  @ApiProperty({ description: 'Payment amount', example: 1500.00 })
  @IsNumber()
  @IsPositive()
  valorPago: number;

  @ApiProperty({ description: 'Payment date', example: '2024-01-15' })
  @IsString()
  dataPagamento: string;

  @ApiProperty({ description: 'Contract ID', example: '1' })
  @IsString()
  contratoId: string;

  @ApiProperty({ description: 'Property ID', example: '1' })
  @IsString()
  propertyId: string;

  @ApiProperty({ description: 'Payment type', enum: PaymentType, example: PaymentType.ALUGUEL })
  @IsEnum(PaymentType)
  tipo: PaymentType;

  @ApiPropertyOptional({ description: 'Receipt file (base64 encoded)' })
  @IsString()
  @IsOptional()
  comprovante?: string;
}
