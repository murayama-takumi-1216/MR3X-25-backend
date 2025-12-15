import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AuditorService {
  constructor(private prisma: PrismaService) {}

  async getDashboardMetrics() {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalAgencies,
      totalUsers,
      totalProperties,
      totalContracts,
      totalPayments,
    ] = await Promise.all([
      this.prisma.agency.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.property.count({ where: { deleted: false } }),
      this.prisma.contract.count({ where: { deleted: false } }),
      this.prisma.payment.count(),
    ]);

    const [
      agenciesLastMonth,
      usersLastMonth,
      propertiesLastMonth,
      contractsLastMonth,
      paymentsLastMonth,
    ] = await Promise.all([
      this.prisma.agency.count({
        where: { status: 'ACTIVE', createdAt: { lt: firstDayThisMonth } }
      }),
      this.prisma.user.count({
        where: { status: 'ACTIVE', createdAt: { lt: firstDayThisMonth } }
      }),
      this.prisma.property.count({
        where: { deleted: false, createdAt: { lt: firstDayThisMonth } }
      }),
      this.prisma.contract.count({
        where: { deleted: false, createdAt: { lt: firstDayThisMonth } }
      }),
      this.prisma.payment.count({
        where: { createdAt: { lt: firstDayThisMonth } }
      }),
    ]);

    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return { trend: current > 0 ? 'up' : 'neutral', change: current > 0 ? '+100%' : '0%' };
      const diff = current - previous;
      const percentage = ((diff / previous) * 100).toFixed(1);
      return {
        trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
        change: diff >= 0 ? `+${percentage}%` : `${percentage}%`,
      };
    };

    const agencyTrend = calculateTrend(totalAgencies, agenciesLastMonth);
    const userTrend = calculateTrend(totalUsers, usersLastMonth);
    const propertyTrend = calculateTrend(totalProperties, propertiesLastMonth);
    const contractTrend = calculateTrend(totalContracts, contractsLastMonth);
    const paymentTrend = calculateTrend(totalPayments, paymentsLastMonth);

    return [
      {
        title: 'Agências',
        value: totalAgencies,
        icon: 'Building2',
        bgColor: 'bg-blue-100',
        color: 'text-blue-600',
        trend: agencyTrend.trend,
        change: agencyTrend.change,
      },
      {
        title: 'Usuários',
        value: totalUsers,
        icon: 'Users',
        bgColor: 'bg-green-100',
        color: 'text-green-600',
        trend: userTrend.trend,
        change: userTrend.change,
      },
      {
        title: 'Imóveis',
        value: totalProperties,
        icon: 'Home',
        bgColor: 'bg-purple-100',
        color: 'text-purple-600',
        trend: propertyTrend.trend,
        change: propertyTrend.change,
      },
      {
        title: 'Contratos',
        value: totalContracts,
        icon: 'FileText',
        bgColor: 'bg-orange-100',
        color: 'text-orange-600',
        trend: contractTrend.trend,
        change: contractTrend.change,
      },
      {
        title: 'Pagamentos',
        value: totalPayments,
        icon: 'Receipt',
        bgColor: 'bg-cyan-100',
        color: 'text-cyan-600',
        trend: paymentTrend.trend,
        change: paymentTrend.change,
      },
    ];
  }

  async getAgencyPlanDistribution() {
    const agencies = await this.prisma.agency.groupBy({
      by: ['plan'],
      _count: { plan: true },
      where: { status: 'ACTIVE' },
    });

    const planColors: Record<string, string> = {
      starter: '#3b82f6',
      professional: '#22c55e',
      enterprise: '#8b5cf6',
      STARTER: '#3b82f6',
      PROFESSIONAL: '#22c55e',
      ENTERPRISE: '#8b5cf6',
    };

    return agencies.map((a: any) => ({
      name: a.plan,
      value: a._count.plan,
      color: planColors[a.plan] || '#6b7280',
    }));
  }

  async getContractStatusDistribution() {
    const contracts = await this.prisma.contract.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { deleted: false },
    });

    const statusColors: Record<string, string> = {
      ATIVO: '#22c55e',
      PENDENTE: '#f59e0b',
      ENCERRADO: '#6b7280',
      CANCELADO: '#ef4444',
      ACTIVE: '#22c55e',
      PENDING: '#f59e0b',
      EXPIRED: '#6b7280',
      CANCELLED: '#ef4444',
    };

    return contracts.map((c: any) => ({
      name: c.status,
      value: c._count.status,
      color: statusColors[c.status] || '#6b7280',
    }));
  }

  async getMonthlyTransactions() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const payments = await this.prisma.payment.findMany({
      where: {
        dataPagamento: { gte: sixMonthsAgo },
      },
      select: {
        valorPago: true,
        dataPagamento: true,
      },
    });

    const monthlyData = new Map<string, { transactions: number; revenue: number }>();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      monthlyData.set(monthKey, { transactions: 0, revenue: 0 });
    }

    payments.forEach((p: any) => {
      if (p.dataPagamento) {
        const monthKey = new Date(p.dataPagamento).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        if (monthlyData.has(monthKey)) {
          const current = monthlyData.get(monthKey)!;
          current.transactions += 1;
          current.revenue += Number(p.valorPago || 0);
        }
      }
    });

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      transactions: data.transactions,
      revenue: data.revenue,
    }));
  }

  async getSignatureActivity() {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const today = new Date();
    const result: { day: string; assinaturas: number; verificacoes: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const [signatures, verifications] = await Promise.all([
        this.prisma.contract.count({
          where: {
            OR: [
              { tenantSignedAt: { gte: startOfDay, lte: endOfDay } },
              { ownerSignedAt: { gte: startOfDay, lte: endOfDay } },
            ],
          },
        }),
        this.prisma.auditLog.count({
          where: {
            event: { contains: 'verif' },
            timestamp: { gte: startOfDay, lte: endOfDay },
          },
        }),
      ]);

      result.push({
        day: days[date.getDay()],
        assinaturas: signatures,
        verificacoes: verifications,
      });
    }

    return result;
  }

  async getUserRoleDistribution() {
    const users = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
      where: { status: 'ACTIVE' },
    });

    const roleColors: Record<string, string> = {
      CEO: '#ef4444',
      ADMIN: '#f97316',
      PLATFORM_MANAGER: '#eab308',
      AGENCY_ADMIN: '#22c55e',
      AGENCY_MANAGER: '#14b8a6',
      BROKER: '#3b82f6',
      PROPRIETARIO: '#8b5cf6',
      INDEPENDENT_OWNER: '#a855f7',
      INQUILINO: '#ec4899',
      BUILDING_MANAGER: '#6366f1',
      LEGAL_AUDITOR: '#64748b',
      REPRESENTATIVE: '#0ea5e9',
      API_CLIENT: '#78716c',
    };

    return users.map((u: any) => ({
      name: u.role,
      value: u._count.role,
      color: roleColors[u.role] || '#6b7280',
    }));
  }

  async getPaymentStatusDistribution() {
    const now = new Date();
    const contracts = await this.prisma.contract.findMany({
      where: { deleted: false, status: 'ATIVO' },
      include: {
        property: {
          select: { nextDueDate: true, monthlyRent: true },
        },
      },
    });

    let onTime = 0;
    let overdue = 0;
    let pending = 0;

    contracts.forEach((c: any) => {
      if (c.property?.nextDueDate) {
        if (new Date(c.property.nextDueDate) < now) {
          overdue++;
        } else {
          onTime++;
        }
      } else {
        pending++;
      }
    });

    return [
      { name: 'Em dia', value: onTime, color: '#22c55e' },
      { name: 'Atrasado', value: overdue, color: '#ef4444' },
      { name: 'Pendente', value: pending, color: '#f59e0b' },
    ];
  }

  async getLogsSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const logs = await this.prisma.auditLog.findMany({
      where: { timestamp: { gte: yesterday } },
      select: { event: true },
    });

    const eventCounts = new Map<string, number>();
    logs.forEach((log: any) => {
      const eventType = log.event?.split('_')[0] || 'OTHER';
      eventCounts.set(eventType, (eventCounts.get(eventType) || 0) + 1);
    });

    if (eventCounts.size === 0) {
      return [
        { type: 'LOGIN', count: 0 },
        { type: 'CREATE', count: 0 },
        { type: 'UPDATE', count: 0 },
        { type: 'DELETE', count: 0 },
        { type: 'VIEW', count: 0 },
      ];
    }

    return Array.from(eventCounts.entries()).map(([type, count]) => ({
      type,
      count,
    }));
  }

  async getRevenueTrend() {
    const now = new Date();
    const result: { month: string; receita: number; taxa: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const payments = await this.prisma.payment.aggregate({
        where: {
          dataPagamento: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { valorPago: true },
      });

      const receita = Number(payments._sum.valorPago || 0);
      result.push({
        month: startDate.toLocaleDateString('pt-BR', { month: 'short' }),
        receita,
        taxa: receita * 0.02,
      });
    }

    return result;
  }

  async getRecentActivity() {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    return logs.map((log: any) => {
      const timestamp = new Date(log.timestamp);
      const hours = timestamp.getHours().toString().padStart(2, '0');
      const minutes = timestamp.getMinutes().toString().padStart(2, '0');

      let type = 'info';
      if (log.event?.toLowerCase().includes('error') || log.event?.toLowerCase().includes('fail')) {
        type = 'warning';
      } else if (log.event?.toLowerCase().includes('success') || log.event?.toLowerCase().includes('create')) {
        type = 'success';
      }

      return {
        time: `${hours}:${minutes}`,
        type,
        event: `${log.user?.name || 'Sistema'}: ${log.event}`,
      };
    });
  }

  async getSystemStatus() {
    const dbStart = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    const apiStart = Date.now();
    await this.prisma.user.count();
    const apiLatency = Date.now() - apiStart;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const errorCount = await this.prisma.auditLog.count({
      where: {
        timestamp: { gte: oneHourAgo },
        event: { contains: 'error' },
      },
    });

    const getStatus = (latency: number, threshold: number) =>
      latency < threshold ? 'healthy' : latency < threshold * 2 ? 'warning' : 'critical';

    return [
      {
        name: 'API Backend',
        latency: `${apiLatency}ms`,
        status: getStatus(apiLatency, 100)
      },
      {
        name: 'Banco de Dados',
        latency: `${dbLatency}ms`,
        status: getStatus(dbLatency, 50)
      },
      {
        name: 'Erros (última hora)',
        latency: `${errorCount} erros`,
        status: errorCount === 0 ? 'healthy' : errorCount < 10 ? 'warning' : 'critical'
      },
    ];
  }

  async getSummaryStats() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      activeUsers,
      weeklySignatures,
      paymentsThisMonth,
      overdueContracts,
      totalActiveContracts,
      successfulLogins,
      failedLogins,
      totalContracts,
      signedContracts,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.contract.count({
        where: {
          OR: [
            { tenantSignedAt: { gte: weekAgo } },
            { ownerSignedAt: { gte: weekAgo } },
          ],
        },
      }),
      this.prisma.payment.aggregate({
        where: { dataPagamento: { gte: firstDayOfMonth } },
        _sum: { valorPago: true },
      }),
      this.prisma.contract.count({
        where: {
          deleted: false,
          status: 'ATIVO',
          property: { nextDueDate: { lt: now } },
        },
      }),
      this.prisma.contract.count({
        where: { deleted: false, status: 'ATIVO' },
      }),
      this.prisma.auditLog.count({
        where: {
          timestamp: { gte: oneDayAgo },
          event: { contains: 'LOGIN_SUCCESS' },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          timestamp: { gte: oneDayAgo },
          event: { contains: 'LOGIN_FAILED' },
        },
      }),
      this.prisma.contract.count({
        where: { deleted: false },
      }),
      this.prisma.contract.count({
        where: {
          deleted: false,
          OR: [
            { tenantSignedAt: { not: null } },
            { ownerSignedAt: { not: null } },
          ],
        },
      }),
    ]);

    const revenueThisMonth = Number(paymentsThisMonth._sum.valorPago || 0);
    const mr3xFee = revenueThisMonth * 0.02;
    const delinquencyRate = totalActiveContracts > 0
      ? ((overdueContracts / totalActiveContracts) * 100).toFixed(1) + '%'
      : '0%';

    const successRate = totalContracts > 0
      ? ((signedContracts / totalContracts) * 100).toFixed(1) + '%'
      : '0%';

    const totalLogins = successfulLogins + failedLogins;
    const loginSuccessRate = totalLogins > 0
      ? ((successfulLogins / totalLogins) * 100).toFixed(1) + '%'
      : '100%';

    return {
      successRate,
      loginSuccessRate,
      activeUsers,
      weeklySignatures,
      delinquencyRate,
      monthlyFee: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mr3xFee),
    };
  }

  async getAgencies(search?: string) {
    const baseWhere: any = {};
    if (search) {
      baseWhere.OR = [
        { name: { contains: search } },
        { cnpj: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [total, active, inactive, suspended] = await Promise.all([
      this.prisma.agency.count({ where: baseWhere }),
      this.prisma.agency.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
      this.prisma.agency.count({ where: { ...baseWhere, status: 'INACTIVE' } }),
      this.prisma.agency.count({ where: { ...baseWhere, status: 'SUSPENDED' } }),
    ]);

    const agencies = await this.prisma.agency.findMany({
      where: baseWhere,
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

    const agenciesWithStats = await Promise.all(
      agencies.map(async (agency: any) => {
        const documentCount = await this.prisma.document.count({
          where: {
            property: { agencyId: agency.id },
          },
        }).catch(() => 0);

        const lastActivity = new Date(agency.updatedAt || agency.createdAt).toLocaleDateString('pt-BR');

        return {
          id: agency.id.toString(),
          name: agency.name,
          cnpj: agency.cnpj || '',
          email: agency.email || '',
          phone: agency.phone || '',
          plan: (agency.plan || 'starter').toLowerCase(),
          status: (agency.status || 'active').toLowerCase(),
          createdAt: agency.createdAt,
          lastActivity,
          stats: {
            properties: agency._count.properties,
            contracts: agency._count.contracts,
            users: agency._count.users,
            documents: documentCount,
          },
        };
      })
    );

    return {
      agencies: agenciesWithStats,
      stats: {
        total,
        active,
        inactive,
        suspended,
      },
    };
  }

  async getUsers(params?: { role?: string; status?: string; search?: string }) {
    const where: any = {};
    if (params?.role) where.role = params.role;
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { email: { contains: params.search } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLogin: true,
        agency: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return users.map((user: any) => ({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      agencyName: user.agency?.name || null,
    }));
  }

  async getDocuments(params?: { type?: string; status?: string; search?: string }) {
    const contracts = await this.prisma.contract.findMany({
      where: { deleted: false },
      select: {
        id: true,
        status: true,
        createdAt: true,
        tenantSignedAt: true,
        ownerSignedAt: true,
        property: {
          select: { name: true, address: true },
        },
        tenantUser: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return contracts.map((contract: any) => ({
      id: contract.id.toString(),
      type: 'CONTRACT',
      name: `Contrato - ${contract.property?.name || contract.property?.address || 'N/A'}`,
      status: contract.tenantSignedAt || contract.ownerSignedAt ? 'SIGNED' : 'PENDING',
      createdAt: contract.createdAt,
      signedAt: contract.tenantSignedAt || contract.ownerSignedAt,
      tenant: contract.tenantUser?.name || 'N/A',
    }));
  }

  async getLogs(params?: { event?: string; entity?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = {};
    if (params?.event) where.event = { contains: params.event };
    if (params?.entity) where.entity = params.entity;
    if (params?.dateFrom) where.timestamp = { ...where.timestamp, gte: new Date(params.dateFrom) };
    if (params?.dateTo) where.timestamp = { ...where.timestamp, lte: new Date(params.dateTo) };

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return logs.map((log: any) => ({
      id: log.id.toString(),
      event: log.event,
      entity: log.entity,
      entityId: log.entityId.toString(),
      timestamp: log.timestamp,
      user: log.user?.name || log.user?.email || 'Sistema',
      ip: log.ip,
      userAgent: log.userAgent,
      dataBefore: log.dataBefore,
      dataAfter: log.dataAfter,
    }));
  }

  async getPayments(params?: { status?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = {};
    if (params?.dateFrom) where.dataPagamento = { ...where.dataPagamento, gte: new Date(params.dateFrom) };
    if (params?.dateTo) where.dataPagamento = { ...where.dataPagamento, lte: new Date(params.dateTo) };

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        property: {
          select: { name: true, address: true },
        },
        user: {
          select: { name: true },
        },
        agency: {
          select: { name: true },
        },
      },
      orderBy: { dataPagamento: 'desc' },
      take: 100,
    });

    return payments.map((payment: any) => ({
      id: payment.id.toString(),
      amount: payment.valorPago,
      date: payment.dataPagamento,
      type: payment.tipo,
      property: payment.property?.name || payment.property?.address || 'N/A',
      tenant: payment.user?.name || 'N/A',
      agency: payment.agency?.name || 'N/A',
    }));
  }

  async getSecurityData() {
    const [
      recentLogins,
      failedLogins,
      activeTokens,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          event: { contains: 'login' },
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          event: { contains: 'failed' },
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.refreshToken.count({
        where: { expiresAt: { gt: new Date() } },
      }),
    ]);

    return {
      recentLogins,
      failedLogins,
      activeTokens,
      securityStatus: failedLogins > 50 ? 'warning' : 'healthy',
    };
  }

  async getIntegrityData() {
    const [
      totalRecords,
      deletedProperties,
      deletedContracts,
      paymentsWithoutContract,
    ] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.property.count({ where: { deleted: true } }),
      this.prisma.contract.count({ where: { deleted: true } }),
      this.prisma.payment.count({ where: { contratoId: { equals: null } } }),
    ]);

    return {
      totalAuditRecords: totalRecords,
      deletedProperties,
      deletedContracts,
      paymentsWithoutContract,
      integrityStatus: deletedProperties > 0 || deletedContracts > 0 ? 'warning' : 'healthy',
    };
  }
}
