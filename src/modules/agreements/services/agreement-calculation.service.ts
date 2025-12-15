import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const ECONOMIC_INDEXES: Record<string, number> = {
  IGPM: 0.008,
  IPCA: 0.005,
  INPC: 0.004,
  SELIC: 0.0095,
  CDI: 0.0093,
};

const SETTLEMENT_OPTIONS = {
  ONE_TIME: {
    id: 'ONE_TIME',
    name: 'Pagamento à Vista',
    description: 'Pague hoje e ganhe desconto máximo',
    installments: 1,
    interestDiscountPercent: 100,
    penaltyDiscountPercent: 50,
    installmentFeePercent: 0,
  },
  TWO_INSTALLMENTS: {
    id: 'TWO_INSTALLMENTS',
    name: '2 Parcelas',
    description: 'Divida em 2x com desconto parcial',
    installments: 2,
    interestDiscountPercent: 50,
    penaltyDiscountPercent: 25,
    installmentFeePercent: 1,
  },
  THREE_INSTALLMENTS: {
    id: 'THREE_INSTALLMENTS',
    name: '3 Parcelas',
    description: 'Divida em 3x',
    installments: 3,
    interestDiscountPercent: 40,
    penaltyDiscountPercent: 20,
    installmentFeePercent: 1.25,
  },
  FOUR_INSTALLMENTS: {
    id: 'FOUR_INSTALLMENTS',
    name: '4 Parcelas',
    description: 'Divida em 4x',
    installments: 4,
    interestDiscountPercent: 30,
    penaltyDiscountPercent: 10,
    installmentFeePercent: 1.5,
  },
  SIX_INSTALLMENTS: {
    id: 'SIX_INSTALLMENTS',
    name: '6 Parcelas',
    description: 'Divida em 6x',
    installments: 6,
    interestDiscountPercent: 20,
    penaltyDiscountPercent: 5,
    installmentFeePercent: 1.75,
  },
};

export interface DebtCalculation {
  invoiceId: string;
  contractId: string;
  baseValue: number;
  dueDate: string;
  calculationDate: string;
  daysOverdue: number;

  readjustmentIndex: string;
  monthlyIndexRate: number;
  penaltyPercent: number;
  monthlyInterestPercent: number;

  correctionFactor: number;
  correctedValue: number;
  penaltyAmount: number;
  interestAmount: number;
  grossTotal: number;

  nextRecalculationAt: string;
}

export interface SettlementOption {
  id: string;
  name: string;
  description: string;
  installments: number;

  originalPenalty: number;
  originalInterest: number;

  interestDiscountPercent: number;
  penaltyDiscountPercent: number;

  penaltyAfterDiscount: number;
  interestAfterDiscount: number;

  installmentFeePercent: number;
  installmentFeeAmount: number;

  finalTotal: number;
  installmentValue: number;

  totalSavings: number;
}

export interface SettlementOptionsResponse {
  debt: DebtCalculation;
  options: SettlementOption[];
  expiresAt: string;
}

@Injectable()
export class AgreementCalculationService {
  constructor(private prisma: PrismaService) {}

  private getMonthlyIndexRate(indexName: string): number {
    const normalizedIndex = indexName?.toUpperCase() || 'IGPM';
    return ECONOMIC_INDEXES[normalizedIndex] || ECONOMIC_INDEXES.IGPM;
  }

  private calculateDaysOverdue(dueDate: Date, calculationDate: Date = new Date()): number {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const calc = new Date(calculationDate);
    calc.setHours(0, 0, 0, 0);

    const diffTime = calc.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  private calculateCorrectionFactor(monthlyIndexRate: number, daysOverdue: number): number {
    if (daysOverdue <= 0) return 1;
    return 1 + (monthlyIndexRate * (daysOverdue / 30));
  }

  private calculatePenalty(correctedValue: number, penaltyPercent: number): number {
    return correctedValue * (penaltyPercent / 100);
  }

  private calculateInterest(correctedValue: number, monthlyInterestPercent: number, daysOverdue: number): number {
    if (daysOverdue <= 0) return 0;
    const dailyRate = (monthlyInterestPercent / 100) / 30;
    return correctedValue * dailyRate * daysOverdue;
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async calculateDebt(invoiceId: string, calculationDate?: Date): Promise<DebtCalculation> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(invoiceId) },
      include: {
        contract: {
          select: {
            id: true,
            lateFeePercent: true,
            interestRatePercent: true,
            readjustmentIndex: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    const calcDate = calculationDate || new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = this.calculateDaysOverdue(dueDate, calcDate);

    if (daysOverdue <= 0) {
      const baseValue = Number(invoice.originalValue);
      return {
        invoiceId: invoice.id.toString(),
        contractId: invoice.contractId.toString(),
        baseValue,
        dueDate: dueDate.toISOString().split('T')[0],
        calculationDate: calcDate.toISOString().split('T')[0],
        daysOverdue: 0,
        readjustmentIndex: invoice.contract?.readjustmentIndex || 'IGPM',
        monthlyIndexRate: 0,
        penaltyPercent: 0,
        monthlyInterestPercent: 0,
        correctionFactor: 1,
        correctedValue: baseValue,
        penaltyAmount: 0,
        interestAmount: 0,
        grossTotal: baseValue,
        nextRecalculationAt: this.getNextMidnight().toISOString(),
      };
    }

    const penaltyPercent = Number(invoice.contract?.lateFeePercent || 2);
    const monthlyInterestPercent = Number(invoice.contract?.interestRatePercent || 1);
    const readjustmentIndex = invoice.contract?.readjustmentIndex || 'IGPM';
    const monthlyIndexRate = this.getMonthlyIndexRate(readjustmentIndex);

    const baseValue = Number(invoice.originalValue);

    const correctionFactor = this.calculateCorrectionFactor(monthlyIndexRate, daysOverdue);
    const correctedValue = this.roundCurrency(baseValue * correctionFactor);

    const penaltyAmount = this.roundCurrency(this.calculatePenalty(correctedValue, penaltyPercent));

    const interestAmount = this.roundCurrency(this.calculateInterest(correctedValue, monthlyInterestPercent, daysOverdue));

    const grossTotal = this.roundCurrency(correctedValue + penaltyAmount + interestAmount);

    return {
      invoiceId: invoice.id.toString(),
      contractId: invoice.contractId.toString(),
      baseValue,
      dueDate: dueDate.toISOString().split('T')[0],
      calculationDate: calcDate.toISOString().split('T')[0],
      daysOverdue,
      readjustmentIndex,
      monthlyIndexRate,
      penaltyPercent,
      monthlyInterestPercent,
      correctionFactor,
      correctedValue,
      penaltyAmount,
      interestAmount,
      grossTotal,
      nextRecalculationAt: this.getNextMidnight().toISOString(),
    };
  }

  async getSettlementOptions(invoiceId: string, calculationDate?: Date): Promise<SettlementOptionsResponse> {
    const debt = await this.calculateDebt(invoiceId, calculationDate);

    const options: SettlementOption[] = Object.values(SETTLEMENT_OPTIONS).map(option => {
      const penaltyDiscount = debt.penaltyAmount * (option.penaltyDiscountPercent / 100);
      const penaltyAfterDiscount = this.roundCurrency(debt.penaltyAmount - penaltyDiscount);

      const interestDiscount = debt.interestAmount * (option.interestDiscountPercent / 100);
      const interestAfterDiscount = this.roundCurrency(debt.interestAmount - interestDiscount);

      const subtotal = debt.correctedValue + penaltyAfterDiscount + interestAfterDiscount;

      let installmentFeeAmount = 0;
      if (option.installments > 1) {
        installmentFeeAmount = this.roundCurrency(subtotal * (option.installmentFeePercent / 100) * option.installments);
      }

      const finalTotal = this.roundCurrency(subtotal + installmentFeeAmount);

      const installmentValue = this.roundCurrency(finalTotal / option.installments);

      const totalSavings = this.roundCurrency(debt.grossTotal - finalTotal);

      return {
        id: option.id,
        name: option.name,
        description: option.description,
        installments: option.installments,
        originalPenalty: debt.penaltyAmount,
        originalInterest: debt.interestAmount,
        interestDiscountPercent: option.interestDiscountPercent,
        penaltyDiscountPercent: option.penaltyDiscountPercent,
        penaltyAfterDiscount,
        interestAfterDiscount,
        installmentFeePercent: option.installmentFeePercent,
        installmentFeeAmount,
        finalTotal,
        installmentValue,
        totalSavings: totalSavings > 0 ? totalSavings : 0,
      };
    });

    options.sort((a, b) => a.finalTotal - b.finalTotal);

    return {
      debt,
      options,
      expiresAt: this.getNextMidnight().toISOString(),
    };
  }

  async acceptSettlement(
    invoiceId: string,
    optionId: string,
    userId: string,
    clientIP?: string,
    userAgent?: string,
  ) {
    const options = await this.getSettlementOptions(invoiceId);
    const selectedOption = options.options.find(o => o.id === optionId);

    if (!selectedOption) {
      throw new BadRequestException('Invalid settlement option');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(invoiceId) },
      include: {
        contract: {
          select: {
            id: true,
            propertyId: true,
            tenantId: true,
            ownerId: true,
            agencyId: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const acceptanceTimestamp = new Date();
    const hashContent = `${invoiceId}|${optionId}|${selectedOption.finalTotal}|${acceptanceTimestamp.toISOString()}|${userId}|${clientIP || ''}`;
    const acceptanceHash = require('crypto').createHash('sha256').update(hashContent).digest('hex');

    return {
      contractId: invoice.contractId.toString(),
      propertyId: invoice.contract?.propertyId.toString(),
      agencyId: invoice.contract?.agencyId?.toString() || null,
      tenantId: invoice.contract?.tenantId.toString(),
      ownerId: invoice.contract?.ownerId?.toString() || null,

      invoiceId: invoice.id.toString(),
      invoiceToken: invoice.token,

      originalAmount: options.debt.grossTotal,
      negotiatedAmount: selectedOption.finalTotal,
      fineAmount: selectedOption.penaltyAfterDiscount,
      discountAmount: selectedOption.totalSavings,
      installments: selectedOption.installments,
      installmentValue: selectedOption.installmentValue,

      calculationDetails: {
        debt: options.debt,
        selectedOption,
        acceptedAt: acceptanceTimestamp.toISOString(),
        acceptanceHash,
        clientIP,
        userAgent,
      },

      acceptanceHash,
      acceptedAt: acceptanceTimestamp,
      acceptedBy: userId,
      clientIP,
      userAgent,
    };
  }

  async calculateMultipleDebts(invoiceIds: string[], calculationDate?: Date): Promise<{
    debts: DebtCalculation[];
    totalGross: number;
    totalBaseValue: number;
    totalPenalty: number;
    totalInterest: number;
    totalCorrection: number;
  }> {
    const debts = await Promise.all(
      invoiceIds.map(id => this.calculateDebt(id, calculationDate))
    );

    const totalBaseValue = debts.reduce((sum, d) => sum + d.baseValue, 0);
    const totalCorrectedValue = debts.reduce((sum, d) => sum + d.correctedValue, 0);
    const totalPenalty = debts.reduce((sum, d) => sum + d.penaltyAmount, 0);
    const totalInterest = debts.reduce((sum, d) => sum + d.interestAmount, 0);
    const totalGross = debts.reduce((sum, d) => sum + d.grossTotal, 0);

    return {
      debts,
      totalGross: this.roundCurrency(totalGross),
      totalBaseValue: this.roundCurrency(totalBaseValue),
      totalPenalty: this.roundCurrency(totalPenalty),
      totalInterest: this.roundCurrency(totalInterest),
      totalCorrection: this.roundCurrency(totalCorrectedValue - totalBaseValue),
    };
  }

  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  simulateDebt(params: {
    baseValue: number;
    dueDate: Date;
    calculationDate?: Date;
    readjustmentIndex?: string;
    penaltyPercent?: number;
    monthlyInterestPercent?: number;
  }): Omit<DebtCalculation, 'invoiceId' | 'contractId'> {
    const {
      baseValue,
      dueDate,
      calculationDate = new Date(),
      readjustmentIndex = 'IGPM',
      penaltyPercent = 2,
      monthlyInterestPercent = 1,
    } = params;

    const daysOverdue = this.calculateDaysOverdue(dueDate, calculationDate);
    const monthlyIndexRate = this.getMonthlyIndexRate(readjustmentIndex);

    if (daysOverdue <= 0) {
      return {
        baseValue,
        dueDate: dueDate.toISOString().split('T')[0],
        calculationDate: calculationDate.toISOString().split('T')[0],
        daysOverdue: 0,
        readjustmentIndex,
        monthlyIndexRate: 0,
        penaltyPercent: 0,
        monthlyInterestPercent: 0,
        correctionFactor: 1,
        correctedValue: baseValue,
        penaltyAmount: 0,
        interestAmount: 0,
        grossTotal: baseValue,
        nextRecalculationAt: this.getNextMidnight().toISOString(),
      };
    }

    const correctionFactor = this.calculateCorrectionFactor(monthlyIndexRate, daysOverdue);
    const correctedValue = this.roundCurrency(baseValue * correctionFactor);
    const penaltyAmount = this.roundCurrency(this.calculatePenalty(correctedValue, penaltyPercent));
    const interestAmount = this.roundCurrency(this.calculateInterest(correctedValue, monthlyInterestPercent, daysOverdue));
    const grossTotal = this.roundCurrency(correctedValue + penaltyAmount + interestAmount);

    return {
      baseValue,
      dueDate: dueDate.toISOString().split('T')[0],
      calculationDate: calculationDate.toISOString().split('T')[0],
      daysOverdue,
      readjustmentIndex,
      monthlyIndexRate,
      penaltyPercent,
      monthlyInterestPercent,
      correctionFactor,
      correctedValue,
      penaltyAmount,
      interestAmount,
      grossTotal,
      nextRecalculationAt: this.getNextMidnight().toISOString(),
    };
  }
}
