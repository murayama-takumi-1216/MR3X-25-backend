import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsEnum, IsOptional } from 'class-validator';
import { PaymentType } from './create-payment.dto';

export class UpdatePaymentDto {
  @ApiPropertyOptional({ description: 'Payment amount', example: 1500.00 })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  valorPago?: number;

  @ApiPropertyOptional({ description: 'Payment date', example: '2024-01-15' })
  @IsString()
  @IsOptional()
  dataPagamento?: string;

  @ApiPropertyOptional({ description: 'Contract ID', example: '1' })
  @IsString()
  @IsOptional()
  contratoId?: string;

  @ApiPropertyOptional({ description: 'Property ID', example: '1' })
  @IsString()
  @IsOptional()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Payment type', enum: PaymentType })
  @IsEnum(PaymentType)
  @IsOptional()
  tipo?: PaymentType;
}
