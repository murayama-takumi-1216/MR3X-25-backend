import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { MicrotransactionType, MicrotransactionStatus } from '@prisma/client';

export interface CreateMicrotransactionDto {
  agencyId?: bigint;
  userId?: bigint;
  type: MicrotransactionType;
  amount: number;
  description?: string;
  contractId?: bigint;
  inspectionId?: bigint;
  agreementId?: bigint;
  analysisId?: bigint;
}

@Injectable()
export class MicrotransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMicrotransaction(dto: CreateMicrotransactionDto) {
    const microtransaction = await this.prisma.microtransaction.create({
      data: {
        agencyId: dto.agencyId,
        userId: dto.userId,
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        status: MicrotransactionStatus.PENDING,
        contractId: dto.contractId,
        inspectionId: dto.inspectionId,
        agreementId: dto.agreementId,
        analysisId: dto.analysisId,
      },
    });

    return microtransaction;
  }

  async generatePaymentLink(microtransactionId: bigint): Promise<string> {
    const transaction = await this.prisma.microtransaction.findUnique({
      where: { id: microtransactionId },
      include: {
        agency: true,
        user: true,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Microtransaction not found');
    }

    if (transaction.status !== MicrotransactionStatus.PENDING) {
      throw new BadRequestException('Microtransaction is not pending payment');
    }

    const paymentLink = `https://payments.mr3x.com.br/pay/${transaction.id}`;

    await this.prisma.microtransaction.update({
      where: { id: microtransactionId },
      data: {
        asaasInvoiceUrl: paymentLink,
        status: MicrotransactionStatus.PROCESSING,
      },
    });

    return paymentLink;
  }

  async markAsPaid(
    microtransactionId: bigint,
    paymentMethod: string,
    asaasPaymentId?: string,
  ) {
    const transaction = await this.prisma.microtransaction.update({
      where: { id: microtransactionId },
      data: {
        status: MicrotransactionStatus.PAID,
        paidAt: new Date(),
        paymentMethod,
        asaasPaymentId,
      },
      include: {
        agency: true,
      },
    });

    if (transaction.agencyId) {
      await this.prisma.agency.update({
        where: { id: transaction.agencyId },
        data: {
          totalSpent: { increment: transaction.amount },
          lastPaymentAt: new Date(),
          lastPaymentAmount: transaction.amount,
        },
      });
    }

    return transaction;
  }

  async markAsFailed(microtransactionId: bigint, reason?: string) {
    return await this.prisma.microtransaction.update({
      where: { id: microtransactionId },
      data: {
        status: MicrotransactionStatus.FAILED,
        notes: reason,
      },
    });
  }

  async refundMicrotransaction(
    microtransactionId: bigint,
    refundAmount: number,
    refundReason: string,
  ) {
    const transaction = await this.prisma.microtransaction.findUnique({
      where: { id: microtransactionId },
    });

    if (!transaction) {
      throw new BadRequestException('Microtransaction not found');
    }

    if (transaction.status !== MicrotransactionStatus.PAID) {
      throw new BadRequestException('Can only refund paid transactions');
    }

    const refunded = await this.prisma.microtransaction.update({
      where: { id: microtransactionId },
      data: {
        status: MicrotransactionStatus.REFUNDED,
        refundedAt: new Date(),
        refundAmount,
        refundReason,
      },
    });

    if (transaction.agencyId) {
      await this.prisma.agency.update({
        where: { id: transaction.agencyId },
        data: {
          totalSpent: { decrement: refundAmount },
        },
      });
    }

    return refunded;
  }

  async getAgencyMicrotransactions(
    agencyId: bigint,
    filters?: {
      status?: MicrotransactionStatus;
      type?: MicrotransactionType;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: any = { agencyId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    return await this.prisma.microtransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getAgencySummary(agencyId: bigint, month?: string) {
    const where: any = { agencyId };

    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59);

      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    const transactions = await this.prisma.microtransaction.findMany({
      where,
    });

    const summary = {
      total: transactions.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      totalAmount: 0,
      totalPaid: 0,
      totalPending: 0,
      totalRefunded: 0,
    };

    transactions.forEach((t) => {
      summary.byStatus[t.status] = (summary.byStatus[t.status] || 0) + 1;

      summary.byType[t.type] = (summary.byType[t.type] || 0) + 1;

      const amount = Number(t.amount);
      summary.totalAmount += amount;

      if (t.status === MicrotransactionStatus.PAID) {
        summary.totalPaid += amount;
      } else if (t.status === MicrotransactionStatus.PENDING) {
        summary.totalPending += amount;
      } else if (t.status === MicrotransactionStatus.REFUNDED) {
        summary.totalRefunded += Number(t.refundAmount || 0);
      }
    });

    return summary;
  }

  async isPaid(microtransactionId: bigint): Promise<boolean> {
    const transaction = await this.prisma.microtransaction.findUnique({
      where: { id: microtransactionId },
      select: { status: true },
    });

    return transaction?.status === MicrotransactionStatus.PAID;
  }

  async getTotalSpending(
    agencyId: bigint,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.prisma.microtransaction.aggregate({
      where: {
        agencyId,
        status: MicrotransactionStatus.PAID,
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount || 0);
  }

  async getMicrotransactionById(microtransactionId: bigint) {
    const transaction = await this.prisma.microtransaction.findUnique({
      where: { id: microtransactionId },
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new BadRequestException('Microtransaction not found');
    }

    return transaction;
  }
}
