import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

export interface HealthData {
  time: string;
  uptime: number;
  responseTime: number;
}

@Injectable()
export class PlatformManagerService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics() {
    const [agenciesCount, usersCount, contractsCount] = await Promise.all([
      this.prisma.agency.count(),
      this.prisma.user.count(),
      this.prisma.contract.count(),
    ]);

    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

    const lastMonthAgencies = await this.prisma.agency.count({
      where: {
        createdAt: {
          lt: lastMonthDate,
        },
      },
    }).catch(() => 0);

    const agencyChange = lastMonthAgencies > 0
      ? Math.round(((agenciesCount - lastMonthAgencies) / lastMonthAgencies) * 100)
      : agenciesCount > 0 ? 100 : 0;

    return [
      {
        title: 'Agências',
        value: agenciesCount,
        icon: 'Building2',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        trend: agencyChange >= 0 ? 'up' : 'down',
        change: `${agencyChange >= 0 ? '+' : ''}${agencyChange}%`,
      },
      {
        title: 'Usuários',
        value: usersCount,
        icon: 'Users',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        trend: 'up',
        change: '+5%',
      },
      {
        title: 'Tickets',
        value: 0,
        icon: 'Ticket',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        trend: 'down',
        change: '0%',
      },
      {
        title: 'Contratos',
        value: contractsCount,
        icon: 'Activity',
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        trend: 'up',
        change: '+8%',
      },
    ];
  }

  async getAgencyStatusDistribution() {
    const statuses = await this.prisma.agency.groupBy({
      by: ['status'],
      _count: { status: true },
    }).catch(() => []);

    const statusColors: Record<string, string> = {
      ACTIVE: '#22c55e',
      INACTIVE: '#ef4444',
      PENDING: '#f59e0b',
      SUSPENDED: '#6b7280',
    };

    const statusNames: Record<string, string> = {
      ACTIVE: 'Ativas',
      INACTIVE: 'Inativas',
      PENDING: 'Pendentes',
      SUSPENDED: 'Suspensas',
    };

    if (!statuses || statuses.length === 0) {
      return [
        { name: 'Ativas', value: 0, color: '#22c55e' },
      ];
    }

    return statuses.map((s) => ({
      name: statusNames[s.status] || s.status,
      value: s._count.status,
      color: statusColors[s.status] || '#6b7280',
    }));
  }

  async getTicketStatusDistribution() {
    return [];
  }

  async getMonthlyTickets() {
    return [];
  }

  async getPlatformHealth() {
    return [];
  }

  async getRecentActivities() {
    try {
      const logs = await this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
        },
      });

      return logs.map((log) => ({
        id: log.id.toString(),
        message: `${log.user?.name || 'Sistema'}: ${log.event} em ${log.entity}`,
        time: this.formatTimeAgo(log.timestamp),
        status: log.event.includes('DELETE') ? 'warning' : 'success',
      }));
    } catch {
      return [];
    }
  }

  async getSystemStatus() {
    return [];
  }

  async getAgencies(params?: { search?: string; status?: string; plan?: string }) {
    const where: any = {};

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { cnpj: { contains: params.search } },
        { email: { contains: params.search } },
      ];
    }

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.plan) {
      where.plan = params.plan;
    }

    const agencies = await this.prisma.agency.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
            properties: true,
            contracts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return agencies.map((agency) => ({
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone,
      status: agency.status,
      plan: agency.plan || 'FREE',
      usersCount: agency._count.users,
      propertiesCount: agency._count.properties,
      contractsCount: agency._count.contracts,
      createdAt: agency.createdAt,
    }));
  }

  async getAgencyById(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        },
        _count: {
          select: {
            users: true,
            properties: true,
            contracts: true,
          },
        },
      },
    });

    if (!agency) {
      return null;
    }

    return {
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone,
      address: agency.address,
      city: agency.city,
      state: agency.state,
      zipCode: agency.zipCode,
      status: agency.status,
      plan: agency.plan,
      users: agency.users.map((u) => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
      stats: {
        users: agency._count.users,
        properties: agency._count.properties,
        contracts: agency._count.contracts,
      },
      createdAt: agency.createdAt,
    };
  }

  async getInternalUsers(params?: { search?: string; role?: string; status?: string }) {
    const internalRoles = ['CEO', 'ADMIN', 'PLATFORM_MANAGER'];

    const where: any = {
      role: { in: internalRoles },
    };

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { email: { contains: params.search } },
      ];
    }

    if (params?.role) {
      where.role = params.role;
    }

    if (params?.status) {
      where.status = params.status;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || 'ACTIVE',
      phone: user.phone,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    }));
  }

  async getLogs(params?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (params?.type) {
      where.event = { contains: params.type };
    }

    if (params?.startDate) {
      where.timestamp = { ...where.timestamp, gte: new Date(params.startDate) };
    }

    if (params?.endDate) {
      where.timestamp = { ...where.timestamp, lte: new Date(params.endDate) };
    }

    try {
      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { timestamp: 'desc' },
          skip,
          take: pageSize,
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return {
        data: logs.map((log) => ({
          id: log.id.toString(),
          event: log.event,
          entity: log.entity,
          entityId: log.entityId.toString(),
          user: log.user?.name || log.user?.email || 'Sistema',
          timestamp: log.timestamp,
          ip: log.ip,
          userAgent: log.userAgent,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch {
      return {
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };
    }
  }

  async getPlansOverview() {
    const plans = await this.prisma.agency.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    const planNames: Record<string, string> = {
      FREE: 'Gratuito',
      BASIC: 'Básico',
      PRO: 'Profissional',
      ENTERPRISE: 'Empresarial',
    };

    return plans.map((p) => ({
      name: planNames[p.plan] || p.plan,
      code: p.plan,
      count: p._count.plan,
    }));
  }

  async getBillingOverview() {
    return {
      totalRevenue: 0,
      monthlyRevenue: 0,
      activeSubscriptions: 0,
      pendingPayments: 0,
      recentTransactions: [],
    };
  }

  async getWebhookLogs(params?: {
    service?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return [];
  }

  async getTickets(params?: { status?: string; priority?: string; category?: string }) {
    return [];
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Há poucos segundos';
    if (seconds < 3600) return `Há ${Math.floor(seconds / 60)} minutos`;
    if (seconds < 86400) return `Há ${Math.floor(seconds / 3600)} horas`;
    return `Há ${Math.floor(seconds / 86400)} dias`;
  }
}
