import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

export interface PenaltyCalculationResult {
  lateFee: Decimal;
  interest: Decimal;
  dailyPenalty: Decimal;
  totalPenalty: Decimal;
  discount: Decimal;
  finalAmount: Decimal;
  daysOverdue: number;
}

export interface EarlyTerminationCalculationResult {
  penaltyAmount: Decimal;
  remainingRent: Decimal;
  totalDue: Decimal;
  monthsRemaining: number;
}

@Injectable()
export class ContractCalculationsService {
  calculateInvoicePenalties(
    originalAmount: Decimal | number,
    dueDate: Date,
    paymentDate: Date = new Date(),
    contract: {
      lateFeePercent?: Decimal | number;
      dailyPenaltyPercent?: Decimal | number;
      interestRatePercent?: Decimal | number;
      earlyPaymentDiscountPercent?: Decimal | number;
      earlyPaymentDiscountDays?: number;
    },
  ): PenaltyCalculationResult {
    const amount = this.toDecimal(originalAmount);
    const now = paymentDate;
    const due = new Date(dueDate);

    const daysDiff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = Math.max(0, daysDiff);

    let lateFee = new Decimal(0);
    let interest = new Decimal(0);
    let dailyPenalty = new Decimal(0);
    let discount = new Decimal(0);

    if (daysOverdue > 0) {
      if (contract.lateFeePercent) {
        const lateFeePercent = this.toDecimal(contract.lateFeePercent);
        lateFee = amount.mul(lateFeePercent).div(100);
      }

      if (contract.dailyPenaltyPercent && daysOverdue > 0) {
        const dailyPenaltyPercent = this.toDecimal(contract.dailyPenaltyPercent);
        dailyPenalty = amount.mul(dailyPenaltyPercent).mul(daysOverdue).div(100);
      }

      if (contract.interestRatePercent && daysOverdue > 0) {
        const interestRatePercent = this.toDecimal(contract.interestRatePercent);
        const monthsOverdue = new Decimal(daysOverdue).div(30);
        interest = amount.mul(interestRatePercent).mul(monthsOverdue).div(100);
      }
    } else if (daysDiff < 0) {
      const daysEarly = Math.abs(daysDiff);
      const discountDays = contract.earlyPaymentDiscountDays || 0;

      if (
        contract.earlyPaymentDiscountPercent &&
        daysEarly >= discountDays &&
        discountDays > 0
      ) {
        const discountPercent = this.toDecimal(contract.earlyPaymentDiscountPercent);
        discount = amount.mul(discountPercent).div(100);
      }
    }

    const totalPenalty = lateFee.add(interest).add(dailyPenalty);
    const finalAmount = amount.add(totalPenalty).sub(discount);

    return {
      lateFee,
      interest,
      dailyPenalty,
      totalPenalty,
      discount,
      finalAmount,
      daysOverdue,
    };
  }

  calculateEarlyTerminationPenalty(
    monthlyRent: Decimal | number,
    contractEndDate: Date,
    terminationDate: Date = new Date(),
    earlyTerminationPenaltyPercent?: Decimal | number,
  ): EarlyTerminationCalculationResult {
    const rent = this.toDecimal(monthlyRent);
    const endDate = new Date(contractEndDate);
    const termDate = new Date(terminationDate);

    const monthsRemaining = this.calculateMonthsDifference(termDate, endDate);

    let penaltyAmount = new Decimal(0);
    if (earlyTerminationPenaltyPercent) {
      const penaltyPercent = this.toDecimal(earlyTerminationPenaltyPercent);
      penaltyAmount = rent.mul(penaltyPercent).div(100).mul(rent);
    }

    const remainingRent = rent.mul(monthsRemaining);

    const totalDue = penaltyAmount.add(remainingRent);

    return {
      penaltyAmount,
      remainingRent,
      totalDue,
      monthsRemaining,
    };
  }

  calculateRentReadjustment(
    currentRent: Decimal | number,
    indexVariationPercent: Decimal | number,
  ): Decimal {
    const rent = this.toDecimal(currentRent);
    const variation = this.toDecimal(indexVariationPercent);

    return rent.mul(new Decimal(1).add(variation.div(100)));
  }

  getDefaultPenaltySettings(agency?: {
    defaultEarlyTerminationPenaltyPercent?: Decimal | number | null;
    defaultLateFeePercent?: Decimal | number | null;
    defaultDailyPenaltyPercent?: Decimal | number | null;
    defaultInterestRatePercent?: Decimal | number | null;
    defaultEarlyPaymentDiscountPercent?: Decimal | number | null;
    defaultEarlyPaymentDiscountDays?: number | null;
    defaultReadjustmentIndex?: string | null;
    defaultReadjustmentMonth?: number | null;
  }) {
    return {
      earlyTerminationPenaltyPercent:
        agency?.defaultEarlyTerminationPenaltyPercent !== null &&
        agency?.defaultEarlyTerminationPenaltyPercent !== undefined
          ? this.toDecimal(agency.defaultEarlyTerminationPenaltyPercent)
          : new Decimal(3.0),
      lateFeePercent:
        agency?.defaultLateFeePercent !== null && agency?.defaultLateFeePercent !== undefined
          ? this.toDecimal(agency.defaultLateFeePercent)
          : new Decimal(2.0),
      dailyPenaltyPercent:
        agency?.defaultDailyPenaltyPercent !== null &&
        agency?.defaultDailyPenaltyPercent !== undefined
          ? this.toDecimal(agency.defaultDailyPenaltyPercent)
          : new Decimal(0.33),
      interestRatePercent:
        agency?.defaultInterestRatePercent !== null &&
        agency?.defaultInterestRatePercent !== undefined
          ? this.toDecimal(agency.defaultInterestRatePercent)
          : new Decimal(1.0),
      earlyPaymentDiscountPercent:
        agency?.defaultEarlyPaymentDiscountPercent !== null &&
        agency?.defaultEarlyPaymentDiscountPercent !== undefined
          ? this.toDecimal(agency.defaultEarlyPaymentDiscountPercent)
          : new Decimal(0.0),
      earlyPaymentDiscountDays:
        agency?.defaultEarlyPaymentDiscountDays !== null &&
        agency?.defaultEarlyPaymentDiscountDays !== undefined
          ? agency.defaultEarlyPaymentDiscountDays
          : 0,
      readjustmentIndex: agency?.defaultReadjustmentIndex || 'IGPM',
      readjustmentMonth: agency?.defaultReadjustmentMonth || 12,
    };
  }

  private toDecimal(value: Decimal | number | string): Decimal {
    if (value instanceof Decimal) {
      return value;
    }
    return new Decimal(value);
  }

  private calculateMonthsDifference(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    let months = (end.getFullYear() - start.getFullYear()) * 12;
    months -= start.getMonth();
    months += end.getMonth();

    return Math.max(0, months);
  }

  formatCurrency(amount: Decimal | number): string {
    const value = this.toDecimal(amount).toNumber();
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  roundCurrency(amount: Decimal): Decimal {
    return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
}
