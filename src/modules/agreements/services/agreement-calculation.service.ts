import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// Brazilian economic indexes (monthly rates - these would ideally come from an external API)
const ECONOMIC_INDEXES: Record<string, number> = {
  IGPM: 0.008,    // 0.80% monthly (example)
  IPCA: 0.005,    // 0.50% monthly (example)
  INPC: 0.004,    // 0.40% monthly (example)
  SELIC: 0.0095,  // 0.95% monthly (example)
  CDI: 0.0093,    // 0.93% monthly (example)
};

// Settlement option discount configurations
const SETTLEMENT_OPTIONS = {
  ONE_TIME: {
    id: 'ONE_TIME',
    name: 'Pagamento à Vista',
    description: 'Pague hoje e ganhe desconto máximo',
    installments: 1,
    interestDiscountPercent: 100, // 100% discount on interest
    penaltyDiscountPercent: 50,   // 50% discount on penalty
    installmentFeePercent: 0,     // No additional fee
  },
  TWO_INSTALLMENTS: {
    id: 'TWO_INSTALLMENTS',
    name: '2 Parcelas',
    description: 'Divida em 2x com desconto parcial',
    installments: 2,
    interestDiscountPercent: 50,  // 50% discount on interest
    penaltyDiscountPercent: 25,   // 25% discount on penalty
    installmentFeePercent: 1,     // 1% total fee
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
    interestDiscountPercent: 30,  // 30% discount on interest (70% kept means 30% discount)
    penaltyDiscountPercent: 10,   // 10% discount on penalty (90% kept means 10% discount)
    installmentFeePercent: 1.5,   // 1.5% per month fee
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

  // Contract parameters used
  readjustmentIndex: string;
  monthlyIndexRate: number;
  penaltyPercent: number;
  monthlyInterestPercent: number;

  // Calculated values
  correctionFactor: number;
  correctedValue: number;
  penaltyAmount: number;
  interestAmount: number;
  grossTotal: number;

  // Daily recalculation indicator
  nextRecalculationAt: string;
}

export interface SettlementOption {
  id: string;
  name: string;
  description: string;
  installments: number;

  // Original values before discount
  originalPenalty: number;
  originalInterest: number;

  // Discounts applied
  interestDiscountPercent: number;
  penaltyDiscountPercent: number;

  // After discount
  penaltyAfterDiscount: number;
  interestAfterDiscount: number;

  // Installment fee (if applicable)
  installmentFeePercent: number;
  installmentFeeAmount: number;

  // Final values
  finalTotal: number;
  installmentValue: number;

  // Savings
  totalSavings: number;
}

export interface SettlementOptionsResponse {
  debt: DebtCalculation;
  options: SettlementOption[];
  expiresAt: string; // Values expire at midnight
}

@Injectable()
export class AgreementCalculationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the monthly index rate for a given adjustment index
   */
  private getMonthlyIndexRate(indexName: string): number {
    const normalizedIndex = indexName?.toUpperCase() || 'IGPM';
    return ECONOMIC_INDEXES[normalizedIndex] || ECONOMIC_INDEXES.IGPM;
  }

  /**
   * Calculate days between two dates
   */
  private calculateDaysOverdue(dueDate: Date, calculationDate: Date = new Date()): number {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const calc = new Date(calculationDate);
    calc.setHours(0, 0, 0, 0);

    const diffTime = calc.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Calculate monetary correction factor using pro-rata approximation
   * Formula: correction_factor = 1 + monthly_index * (days / 30)
   */
  private calculateCorrectionFactor(monthlyIndexRate: number, daysOverdue: number): number {
    if (daysOverdue <= 0) return 1;
    return 1 + (monthlyIndexRate * (daysOverdue / 30));
  }

  /**
   * Calculate penalty amount (single charge)
   * Formula: penalty = corrected_value * penalty_percent
   */
  private calculatePenalty(correctedValue: number, penaltyPercent: number): number {
    return correctedValue * (penaltyPercent / 100);
  }

  /**
   * Calculate daily interest (simple pro-rata)
   * Formula: interest = corrected_value * (monthly_rate / 30) * days
   */
  private calculateInterest(correctedValue: number, monthlyInterestPercent: number, daysOverdue: number): number {
    if (daysOverdue <= 0) return 0;
    const dailyRate = (monthlyInterestPercent / 100) / 30;
    return correctedValue * dailyRate * daysOverdue;
  }

  /**
   * Round to 2 decimal places (Brazilian currency standard)
   */
  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Calculate the current debt for an invoice
   */
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

    // If not overdue, no additional charges
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

    // Get contract parameters (with defaults)
    const penaltyPercent = Number(invoice.contract?.lateFeePercent || 2);
    const monthlyInterestPercent = Number(invoice.contract?.interestRatePercent || 1);
    const readjustmentIndex = invoice.contract?.readjustmentIndex || 'IGPM';
    const monthlyIndexRate = this.getMonthlyIndexRate(readjustmentIndex);

    // Base value
    const baseValue = Number(invoice.originalValue);

    // Step 1: Apply monetary correction
    const correctionFactor = this.calculateCorrectionFactor(monthlyIndexRate, daysOverdue);
    const correctedValue = this.roundCurrency(baseValue * correctionFactor);

    // Step 2: Calculate penalty (single charge on corrected value)
    const penaltyAmount = this.roundCurrency(this.calculatePenalty(correctedValue, penaltyPercent));

    // Step 3: Calculate interest (daily accrual on corrected value)
    const interestAmount = this.roundCurrency(this.calculateInterest(correctedValue, monthlyInterestPercent, daysOverdue));

    // Step 4: Calculate gross total
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

  /**
   * Generate all available settlement options for an invoice
   */
  async getSettlementOptions(invoiceId: string, calculationDate?: Date): Promise<SettlementOptionsResponse> {
    const debt = await this.calculateDebt(invoiceId, calculationDate);

    const options: SettlementOption[] = Object.values(SETTLEMENT_OPTIONS).map(option => {
      // Calculate discounted penalty
      const penaltyDiscount = debt.penaltyAmount * (option.penaltyDiscountPercent / 100);
      const penaltyAfterDiscount = this.roundCurrency(debt.penaltyAmount - penaltyDiscount);

      // Calculate discounted interest
      const interestDiscount = debt.interestAmount * (option.interestDiscountPercent / 100);
      const interestAfterDiscount = this.roundCurrency(debt.interestAmount - interestDiscount);

      // Calculate subtotal before installment fee
      const subtotal = debt.correctedValue + penaltyAfterDiscount + interestAfterDiscount;

      // Calculate installment fee (applied on subtotal for multi-installment options)
      let installmentFeeAmount = 0;
      if (option.installments > 1) {
        // Fee is monthly rate × number of months (simple calculation)
        installmentFeeAmount = this.roundCurrency(subtotal * (option.installmentFeePercent / 100) * option.installments);
      }

      // Calculate final total
      const finalTotal = this.roundCurrency(subtotal + installmentFeeAmount);

      // Calculate installment value
      const installmentValue = this.roundCurrency(finalTotal / option.installments);

      // Calculate total savings compared to gross total
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

    // Sort by final total (ascending)
    options.sort((a, b) => a.finalTotal - b.finalTotal);

    return {
      debt,
      options,
      expiresAt: this.getNextMidnight().toISOString(),
    };
  }

  /**
   * Accept a settlement option and freeze the values
   * Returns the data needed to create the agreement
   */
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

    // Generate acceptance hash for legal tracking
    const acceptanceTimestamp = new Date();
    const hashContent = `${invoiceId}|${optionId}|${selectedOption.finalTotal}|${acceptanceTimestamp.toISOString()}|${userId}|${clientIP || ''}`;
    const acceptanceHash = require('crypto').createHash('sha256').update(hashContent).digest('hex');

    return {
      // Agreement creation data
      contractId: invoice.contractId.toString(),
      propertyId: invoice.contract?.propertyId.toString(),
      agencyId: invoice.contract?.agencyId?.toString() || null,
      tenantId: invoice.contract?.tenantId.toString(),
      ownerId: invoice.contract?.ownerId?.toString() || null,

      // Invoice reference
      invoiceId: invoice.id.toString(),
      invoiceToken: invoice.token,

      // Financial data (frozen at this moment)
      originalAmount: options.debt.grossTotal,
      negotiatedAmount: selectedOption.finalTotal,
      fineAmount: selectedOption.penaltyAfterDiscount,
      discountAmount: selectedOption.totalSavings,
      installments: selectedOption.installments,
      installmentValue: selectedOption.installmentValue,

      // Calculation details (for audit)
      calculationDetails: {
        debt: options.debt,
        selectedOption,
        acceptedAt: acceptanceTimestamp.toISOString(),
        acceptanceHash,
        clientIP,
        userAgent,
      },

      // Legal tracking
      acceptanceHash,
      acceptedAt: acceptanceTimestamp,
      acceptedBy: userId,
      clientIP,
      userAgent,
    };
  }

  /**
   * Calculate debt for multiple invoices (for agreement covering multiple debts)
   */
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

  /**
   * Get next midnight for expiration timestamp
   */
  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Simulate debt calculation for a given scenario (useful for testing/preview)
   */
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
