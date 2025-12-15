import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PlanEnforcementService } from '../plans/plan-enforcement.service';
import { getPlanLimitsForEntity } from '../plans/plans.data';

export interface AgencyCreateDTO {
  name: string;
  tradeName?: string;
  cnpj: string;
  email: string;
  phone?: string;
  representativeName?: string;
  representativeDocument?: string;
  creci?: string;
  creciState?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  plan?: string;
  maxProperties?: number;
  maxUsers?: number;
  agencyFee?: number;
}

export interface AgencyUpdateDTO {
  name?: string;
  tradeName?: string;
  email?: string;
  phone?: string;
  representativeName?: string;
  representativeDocument?: string;
  creci?: string;
  creciState?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  plan?: string;
  status?: string;
  maxProperties?: number;
  maxUsers?: number;
  agencyFee?: number;
}

@Injectable()
export class AgenciesService {
  constructor(
    private prisma: PrismaService,
    private planEnforcement: PlanEnforcementService,
  ) {}

  async createAgency(data: AgencyCreateDTO) {
    const cleanCnpj = data.cnpj.replace(/\D/g, '');
    const existingAgency = await this.prisma.agency.findUnique({
      where: { cnpj: cleanCnpj },
    });

    if (existingAgency) {
      throw new BadRequestException('Agency with this CNPJ already exists');
    }

    const existingEmail = await this.prisma.agency.findFirst({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new BadRequestException('Agency with this email already exists');
    }

    const planName = data.plan || 'FREE';
    const planLimits = getPlanLimitsForEntity(planName, 'agency');

    const agency = await this.prisma.agency.create({
      data: {
        name: data.name,
        cnpj: cleanCnpj,
        email: data.email,
        phone: data.phone || null,
        creci: data.creci || null,
        creciState: data.creciState || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        plan: planName,
        status: 'ACTIVE',
        maxProperties: planLimits.contracts,
        maxUsers: planLimits.users,
        agencyFee: data.agencyFee ?? 8,
        apiEnabled: planLimits.apiAccess,
        lastPlanChange: new Date(),
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        creci: true,
        creciState: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        apiEnabled: true,
        frozenPropertiesCount: true,
        frozenUsersCount: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
    });

    return {
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      creci: agency.creci || '',
      creciState: agency.creciState || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties || 0,
      maxUsers: agency.maxUsers || 0,
      agencyFee: agency.agencyFee ?? 8,
      apiEnabled: agency.apiEnabled,
      frozenPropertiesCount: agency.frozenPropertiesCount,
      frozenUsersCount: agency.frozenUsersCount,
      userCount: agency._count.users,
      propertyCount: agency._count.properties,
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
    };
  }

  async getAgencies() {
    const agencies = await this.prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        creci: true,
        creciState: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return agencies.map(agency => ({
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      creci: agency.creci || '',
      creciState: agency.creciState || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties || 0,
      maxUsers: agency.maxUsers || 0,
      agencyFee: agency.agencyFee ?? 8,
      userCount: agency._count.users,
      propertyCount: agency._count.properties,
    }));
  }

  async getAgencyById(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        name: true,
        tradeName: true,
        cnpj: true,
        email: true,
        phone: true,
        representativeName: true,
        representativeDocument: true,
        creci: true,
        creciState: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        properties: {
          select: {
            id: true,
            name: true,
            address: true,
            status: true,
          },
        },
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    try {
      await this.planEnforcement.enforceCurrentPlanLimits(id);
    } catch (error) {
      console.error('Error enforcing plan limits:', error);
    }

    return {
      id: agency.id.toString(),
      name: agency.name,
      tradeName: agency.tradeName || '',
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      representativeName: agency.representativeName || '',
      representativeDocument: agency.representativeDocument || '',
      creci: agency.creci || '',
      creciState: agency.creciState || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties,
      maxUsers: agency.maxUsers,
      agencyFee: agency.agencyFee,
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
      users: agency.users.map(u => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
      properties: agency.properties.map(p => ({
        id: p.id.toString(),
        name: p.name,
        address: p.address,
        status: p.status,
      })),
    };
  }

  async updateAgency(id: string, data: AgencyUpdateDTO) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    if (data.email && data.email !== agency.email) {
      const existingEmail = await this.prisma.agency.findFirst({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new BadRequestException('Agency with this email already exists');
      }
    }

    const isPlanChange = data.plan && data.plan !== agency.plan;
    let planEnforcementResult: Awaited<ReturnType<typeof this.planEnforcement.enforcePlanLimits>> | null = null;

    if (isPlanChange && data.plan) {
      const newPlanLimits = getPlanLimitsForEntity(data.plan, 'agency');

      const updated = await this.prisma.agency.update({
        where: { id: BigInt(id) },
        data: {
          name: data.name,
          tradeName: data.tradeName,
          email: data.email,
          phone: data.phone,
          representativeName: data.representativeName,
          representativeDocument: data.representativeDocument,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          plan: data.plan,
          status: data.status,
          maxProperties: newPlanLimits.contracts,
          maxUsers: newPlanLimits.users,
          agencyFee: data.agencyFee !== undefined ? Math.max(0, Math.min(100, data.agencyFee)) : undefined,
          lastPlanChange: new Date(),
        },
        select: {
          id: true,
          name: true,
          tradeName: true,
          cnpj: true,
          email: true,
          phone: true,
          representativeName: true,
          representativeDocument: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          status: true,
          plan: true,
          maxProperties: true,
          maxUsers: true,
          agencyFee: true,
          apiEnabled: true,
          frozenPropertiesCount: true,
          frozenUsersCount: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              properties: true,
            },
          },
        },
      });

      planEnforcementResult = await this.planEnforcement.enforcePlanLimits(id, data.plan!);

      const updatedAgency = await this.prisma.agency.findUnique({
        where: { id: BigInt(id) },
        select: {
          frozenPropertiesCount: true,
          frozenUsersCount: true,
        },
      });

      return {
        id: updated.id.toString(),
        name: updated.name,
        tradeName: updated.tradeName || '',
        cnpj: updated.cnpj,
        email: updated.email,
        phone: updated.phone || '',
        representativeName: updated.representativeName || '',
        representativeDocument: updated.representativeDocument || '',
        address: updated.address || '',
        city: updated.city || '',
        state: updated.state || '',
        zipCode: updated.zipCode || '',
        status: updated.status,
        plan: updated.plan,
        maxProperties: updated.maxProperties,
        maxUsers: updated.maxUsers,
        agencyFee: updated.agencyFee,
        apiEnabled: updated.apiEnabled,
        frozenPropertiesCount: updatedAgency?.frozenPropertiesCount || 0,
        frozenUsersCount: updatedAgency?.frozenUsersCount || 0,
        propertyCount: updated._count.properties,
        userCount: updated._count.users,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        planEnforcement: planEnforcementResult,
      };
    }

    const updated = await this.prisma.agency.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        tradeName: data.tradeName,
        email: data.email,
        phone: data.phone,
        representativeName: data.representativeName,
        representativeDocument: data.representativeDocument,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        status: data.status,
        agencyFee: data.agencyFee !== undefined ? Math.max(0, Math.min(100, data.agencyFee)) : undefined,
      },
      select: {
        id: true,
        name: true,
        tradeName: true,
        cnpj: true,
        email: true,
        phone: true,
        representativeName: true,
        representativeDocument: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        apiEnabled: true,
        frozenPropertiesCount: true,
        frozenUsersCount: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
    });

    return {
      id: updated.id.toString(),
      name: updated.name,
      tradeName: updated.tradeName || '',
      cnpj: updated.cnpj,
      email: updated.email,
      phone: updated.phone || '',
      representativeName: updated.representativeName || '',
      representativeDocument: updated.representativeDocument || '',
      address: updated.address || '',
      city: updated.city || '',
      state: updated.state || '',
      zipCode: updated.zipCode || '',
      status: updated.status,
      plan: updated.plan,
      maxProperties: updated.maxProperties,
      maxUsers: updated.maxUsers,
      agencyFee: updated.agencyFee,
      apiEnabled: updated.apiEnabled,
      frozenPropertiesCount: updated.frozenPropertiesCount,
      frozenUsersCount: updated.frozenUsersCount,
      propertyCount: updated._count.properties,
      userCount: updated._count.users,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteAgency(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
      include: {
        users: true,
        properties: true,
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    if (agency.users.length > 0) {
      throw new BadRequestException('Cannot delete agency with associated users');
    }

    if (agency.properties.length > 0) {
      throw new BadRequestException('Cannot delete agency with associated properties');
    }

    await this.prisma.agency.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Agency deleted successfully' };
  }

  async getPlanUsage(agencyId: string) {
    return this.planEnforcement.getFrozenEntitiesSummary(agencyId);
  }

  async getFrozenEntities(agencyId: string) {
    return this.planEnforcement.getFrozenEntitiesList(agencyId);
  }

  async previewPlanChange(agencyId: string, newPlan: string) {
    return this.planEnforcement.previewPlanChange(agencyId, newPlan);
  }

  async switchActiveContract(agencyId: string, newActiveContractId: string) {
    return this.planEnforcement.switchActiveContract(agencyId, newActiveContractId);
  }

  async enforcePlanLimits(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    return this.planEnforcement.enforcePlanLimits(agencyId, agency.plan);
  }

  async checkContractCreationAllowed(agencyId: string) {
    return this.planEnforcement.checkContractOperationAllowed(agencyId, 'create');
  }

  async checkUserCreationAllowed(agencyId: string) {
    return this.planEnforcement.checkUserOperationAllowed(agencyId, 'create');
  }

  async changePlan(agencyId: string, newPlan: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const enforcementResult = await this.planEnforcement.enforcePlanLimits(agencyId, newPlan);

    const newPlanLimits = getPlanLimitsForEntity(newPlan, 'agency');

    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        plan: newPlan,
        maxProperties: newPlanLimits.contracts,
        maxUsers: newPlanLimits.users,
        lastPlanChange: new Date(),
      },
    });

    const updatedAgency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: {
        id: true,
        name: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        frozenContractsCount: true,
        frozenUsersCount: true,
      },
    });

    return {
      success: true,
      agency: {
        id: updatedAgency?.id.toString(),
        name: updatedAgency?.name,
        plan: updatedAgency?.plan,
        maxProperties: updatedAgency?.maxProperties,
        maxUsers: updatedAgency?.maxUsers,
      },
      enforcement: enforcementResult,
      message: enforcementResult.message,
    };
  }
}
