import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

export const PLAN_LIMITS = {
  FREE: {
    maxContracts: 1,
    maxUsers: 2,
    maxProperties: 1,
    features: {
      inspections: false,
      settlements: false,
      screening: false,
      api: false,
      whatsapp: false,
      analytics: false,
    },
    microtransactionPrices: {
      extraContract: 4.90,
      inspection: 3.90,
      settlement: 6.90,
      screening: 8.90,
    },
  },
  BASIC: {
    maxContracts: 20,
    maxUsers: 5,
    maxProperties: 20,
    features: {
      inspections: true,
      settlements: true,
      screening: false,
      api: false,
      whatsapp: false,
      analytics: true,
    },
    microtransactionPrices: {
      screening: 8.90,
    },
  },
  PROFESSIONAL: {
    maxContracts: 60,
    maxUsers: 10,
    maxProperties: 60,
    features: {
      inspections: true,
      settlements: true,
      screening: true,
      api: false,
      whatsapp: true,
      analytics: true,
    },
    microtransactionPrices: {},
  },
  ENTERPRISE: {
    maxContracts: 200,
    maxUsers: 999999,
    maxProperties: 200,
    features: {
      inspections: true,
      settlements: true,
      screening: true,
      api: true,
      whatsapp: true,
      analytics: true,
    },
    microtransactionPrices: {},
  },
};

export interface PlanCheckResult {
  allowed: boolean;
  requiresPayment: boolean;
  microtransactionPrice?: number;
  message?: string;
  currentCount?: number;
  maxAllowed?: number;
}

@Injectable()
export class PlanEnforcementService {
  constructor(private readonly prisma: PrismaService) {}

  async checkContractCreation(agencyId: bigint): Promise<PlanCheckResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        plan: true,
        maxContracts: true,
        activeContractsCount: true,
        subscriptionStatus: true,
      },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active. Please update your payment method.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;
    const currentCount = agency.activeContractsCount || 0;
    const maxAllowed = agency.maxContracts || planLimits.maxContracts;

    if (currentCount < maxAllowed) {
      return {
        allowed: true,
        requiresPayment: false,
        currentCount,
        maxAllowed,
      };
    }

    if (agency.plan === 'FREE') {
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: planLimits.microtransactionPrices.extraContract,
        message: `You've reached your plan limit of ${maxAllowed} contract(s). An additional charge of R$ ${planLimits.microtransactionPrices.extraContract.toFixed(2)} will apply for this extra contract.`,
        currentCount,
        maxAllowed,
      };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: `You've reached your plan limit of ${maxAllowed} contracts. Please upgrade your plan to create more contracts.`,
      currentCount,
      maxAllowed,
    };
  }

  async checkInspectionCreation(agencyId: bigint | null, userId: bigint): Promise<PlanCheckResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, agencyId: true },
    });

    if (user?.role === 'INDEPENDENT_OWNER') {
      return { allowed: true, requiresPayment: false };
    }

    if (!agencyId) {
      throw new BadRequestException('Agency ID required for inspection creation');
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true, subscriptionStatus: true },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    if (planLimits.features.inspections) {
      return { allowed: true, requiresPayment: false };
    }

    if (agency.plan === 'FREE') {
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: planLimits.microtransactionPrices.inspection,
        message: `Professional inspection reports require a payment of R$ ${planLimits.microtransactionPrices.inspection.toFixed(2)} on the FREE plan. Upgrade to BASIC or higher for unlimited inspections.`,
      };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: 'Inspections are not available on your plan.',
    };
  }

  async checkSettlementCreation(agencyId: bigint | null): Promise<PlanCheckResult> {
    if (!agencyId) {
      return { allowed: true, requiresPayment: false };
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true, subscriptionStatus: true },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    if (planLimits.features.settlements) {
      return { allowed: true, requiresPayment: false };
    }

    if (agency.plan === 'FREE') {
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: planLimits.microtransactionPrices.settlement,
        message: `Settlement documents require a payment of R$ ${planLimits.microtransactionPrices.settlement.toFixed(2)} on the FREE plan.`,
      };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: 'Settlements are not available on your plan.',
    };
  }

  async checkScreeningCreation(agencyId: bigint | null): Promise<PlanCheckResult> {
    if (!agencyId) {
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: PLAN_LIMITS.FREE.microtransactionPrices.screening,
        message: `Tenant credit analysis costs R$ ${PLAN_LIMITS.FREE.microtransactionPrices.screening.toFixed(2)}.`,
      };
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true, subscriptionStatus: true },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    if (planLimits.features.screening) {
      return { allowed: true, requiresPayment: false };
    }

    const price = planLimits.microtransactionPrices.screening;
    if (price) {
      return {
        allowed: true,
        requiresPayment: true,
        microtransactionPrice: price,
        message: `Tenant credit analysis costs R$ ${price.toFixed(2)} on the ${agency.plan} plan.`,
      };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: 'Screening is not available on your plan.',
    };
  }

  async checkUserCreation(agencyId: bigint): Promise<PlanCheckResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        plan: true,
        maxUsers: true,
        activeUsersCount: true,
        subscriptionStatus: true,
      },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;
    const currentCount = agency.activeUsersCount || 0;
    const maxAllowed = agency.maxUsers || planLimits.maxUsers;

    if (currentCount < maxAllowed) {
      return {
        allowed: true,
        requiresPayment: false,
        currentCount,
        maxAllowed,
      };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: `You've reached your plan limit of ${maxAllowed} users. Please upgrade your plan to add more users.`,
      currentCount,
      maxAllowed,
    };
  }

  async checkApiAccess(agencyId: bigint): Promise<PlanCheckResult> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true, apiEnabled: true, subscriptionStatus: true },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.subscriptionStatus !== 'ACTIVE') {
      return {
        allowed: false,
        requiresPayment: false,
        message: 'Subscription is not active.',
      };
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    if (planLimits.features.api && agency.apiEnabled) {
      return { allowed: true, requiresPayment: false };
    }

    return {
      allowed: false,
      requiresPayment: false,
      message: 'API access is only available on the ENTERPRISE plan.',
    };
  }

  async incrementContractCount(agencyId: bigint): Promise<void> {
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        activeContractsCount: { increment: 1 },
      },
    });
  }

  async decrementContractCount(agencyId: bigint): Promise<void> {
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        activeContractsCount: { decrement: 1 },
      },
    });
  }

  async incrementUserCount(agencyId: bigint): Promise<void> {
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        activeUsersCount: { increment: 1 },
      },
    });
  }

  async decrementUserCount(agencyId: bigint): Promise<void> {
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        activeUsersCount: { decrement: 1 },
      },
    });
  }

  async getPlanInfo(agencyId: bigint) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        plan: true,
        maxContracts: true,
        maxUsers: true,
        maxProperties: true,
        activeContractsCount: true,
        activeUsersCount: true,
        activePropertiesCount: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        nextBillingDate: true,
        trialEndsAt: true,
        totalSpent: true,
      },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    const planLimits = PLAN_LIMITS[agency.plan] || PLAN_LIMITS.FREE;

    return {
      currentPlan: agency.plan,
      subscriptionStatus: agency.subscriptionStatus,
      limits: {
        maxContracts: agency.maxContracts || planLimits.maxContracts,
        maxUsers: agency.maxUsers || planLimits.maxUsers,
        maxProperties: agency.maxProperties || planLimits.maxProperties,
      },
      usage: {
        contracts: agency.activeContractsCount || 0,
        users: agency.activeUsersCount || 0,
        properties: agency.activePropertiesCount || 0,
      },
      features: planLimits.features,
      microtransactionPrices: planLimits.microtransactionPrices || {},
      billing: {
        currentPeriodEnd: agency.currentPeriodEnd,
        nextBillingDate: agency.nextBillingDate,
        trialEndsAt: agency.trialEndsAt,
        totalSpent: agency.totalSpent,
      },
    };
  }
}
