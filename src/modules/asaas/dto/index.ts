import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, Min } from 'class-validator';

export enum BillingType {
  BOLETO = 'BOLETO',
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  UNDEFINED = 'UNDEFINED',
}

export class CreateEntityPaymentDto {
  @IsString()
  entityType: 'invoice' | 'agreement' | 'microtransaction';

  @IsString()
  entityId: string;

  @IsOptional()
  @IsEnum(BillingType)
  billingType?: BillingType;
}

export class SyncCustomerDto {
  @IsString()
  userId: string;
}

export class CancelPaymentDto {
  @IsString()
  paymentId: string;
}

export class RefundPaymentDto {
  @IsString()
  paymentId: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  value?: number;
}

export class ReceiveInCashDto {
  @IsString()
  paymentId: string;

  @IsDateString()
  paymentDate: string;

  @IsNumber()
  @Min(0.01)
  value: number;
}

export class GetPixQrCodeDto {
  @IsString()
  paymentId: string;
}

export class ListPaymentsDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(BillingType)
  billingType?: BillingType;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsNumber()
  offset?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class CreateAsaasCustomerDto {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsString()
  cpfCnpj: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobilePhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  addressNumber?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;
}

export class CreateDirectPaymentDto {
  @IsString()
  customerId: string;

  @IsNumber()
  @Min(0.01)
  value: number;

  @IsDateString()
  dueDate: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsEnum(BillingType)
  billingType?: BillingType;

  @IsOptional()
  @IsNumber()
  installmentCount?: number;
}
