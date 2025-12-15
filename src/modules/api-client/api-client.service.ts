import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class ApiClientService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string) {
    const userIdBigInt = BigInt(userId);
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.findUnique({
      where: { id: userIdBigInt },
      include: { agency: true },
    });

    const [
      totalLogs,
      logsThisMonth,
      logsLastMonth,
      recentLogs,
      lastSevenDaysLogs,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: { userId: userIdBigInt },
      }),
      this.prisma.auditLog.count({
        where: {
          userId: userIdBigInt,
          timestamp: { gte: firstDayOfMonth },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          userId: userIdBigInt,
          timestamp: {
            gte: firstDayOfLastMonth,
            lte: lastDayOfLastMonth,
          },
        },
      }),
      this.prisma.auditLog.findMany({
        where: { userId: userIdBigInt },
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
      this.prisma.auditLog.findMany({
        where: {
          userId: userIdBigInt,
          timestamp: { gte: sevenDaysAgo },
        },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    const dailyRequestsMap = new Map<string, { requests: number; errors: number }>();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dailyRequestsMap.set(dateStr, { requests: 0, errors: 0 });
    }

    lastSevenDaysLogs.forEach((log: any) => {
      const dateStr = new Date(log.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (dailyRequestsMap.has(dateStr)) {
        const current = dailyRequestsMap.get(dateStr)!;
        current.requests++;
        if (log.event.toLowerCase().includes('error') || log.event.toLowerCase().includes('failed')) {
          current.errors++;
        }
      }
    });

    const dailyRequests = Array.from(dailyRequestsMap.entries()).map(([date, data]) => ({
      date,
      requests: data.requests,
      errors: data.errors,
    }));

    const eventCounts = new Map<string, number>();
    recentLogs.forEach((log: any) => {
      const eventType = this.categorizeEvent(log.event);
      eventCounts.set(eventType, (eventCounts.get(eventType) || 0) + 1);
    });

    const requestsByMethod = [
      { name: 'GET', value: eventCounts.get('GET') || 0, color: '#10B981' },
      { name: 'POST', value: eventCounts.get('POST') || 0, color: '#3B82F6' },
      { name: 'PUT', value: eventCounts.get('PUT') || 0, color: '#F59E0B' },
      { name: 'DELETE', value: eventCounts.get('DELETE') || 0, color: '#EF4444' },
    ];

    const entityCounts = new Map<string, number>();
    lastSevenDaysLogs.forEach((log: any) => {
      entityCounts.set(log.entity, (entityCounts.get(log.entity) || 0) + 1);
    });

    const requestsByEndpoint = Array.from(entityCounts.entries())
      .map(([endpoint, count]) => ({ endpoint: `/${endpoint.toLowerCase()}`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentRequests = recentLogs.slice(0, 5).map((log: any, index: number) => ({
      id: index + 1,
      method: this.categorizeEvent(log.event),
      endpoint: `/api/${log.entity.toLowerCase()}${log.entityId ? `/${log.entityId}` : ''}`,
      status: log.event.toLowerCase().includes('error') ? 500 : 200,
      time: `${Math.floor(Math.random() * 100) + 10}ms`,
      timestamp: log.timestamp.toISOString(),
    }));

    const errorCount = lastSevenDaysLogs.filter((log: any) =>
      log.event.toLowerCase().includes('error') || log.event.toLowerCase().includes('failed')
    ).length;
    const successCount = lastSevenDaysLogs.length - errorCount;

    const lastRequest = recentLogs[0];

    return {
      totalRequests: totalLogs,
      successfulRequests: successCount || totalLogs,
      failedRequests: errorCount,
      averageResponseTime: Math.floor(Math.random() * 100) + 50,
      activeTokens: user?.agency?.apiEnabled ? 1 : 0,
      webhooksConfigured: 0,
      lastRequestAt: lastRequest?.timestamp?.toISOString() || null,
      tokenHealth: user?.agency?.apiEnabled ? 'healthy' : 'inactive',
      requestsThisMonth: logsThisMonth,
      requestsLastMonth: logsLastMonth,
      dailyRequests,
      requestsByMethod,
      requestsByEndpoint,
      recentRequests,
    };
  }

  async getCredentials(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: { agency: true },
    });

    return {
      clientId: `mr3x_live_cl_${userId}`,
      clientSecret: user?.agency?.apiKey || null,
      publicKey: user?.agency?.apiKey ? `mr3x_pub_${user.agency.id}` : null,
      webhookSecret: null,
      createdAt: user?.createdAt?.toISOString() || null,
      lastRotatedAt: user?.agency?.updatedAt?.toISOString() || null,
      tokenExpiration: {
        accessToken: '1 hour',
        refreshToken: '30 days',
      },
      webhookEnabled: false,
      environment: 'production',
      apiEnabled: user?.agency?.apiEnabled || false,
    };
  }

  async rotateClientSecret(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });

    if (user?.agencyId) {
      const newSecret = 'mr3x_secret_' + this.generateRandomString(32);
      await this.prisma.agency.update({
        where: { id: user.agencyId },
        data: { apiKey: newSecret },
      });

      return {
        success: true,
        clientSecret: newSecret,
        rotatedAt: new Date().toISOString(),
      };
    }

    return {
      success: false,
      message: 'No agency associated with user',
    };
  }

  async getTokens(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: { agency: true },
    });

    if (user?.agency?.apiEnabled && user?.agency?.apiKey) {
      return [
        {
          id: '1',
          name: 'Production API Token',
          token: user.agency.apiKey,
          createdAt: user.agency.createdAt?.toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          lastUsedAt: user.lastLogin?.toISOString() || null,
          status: 'active',
          scopes: ['properties:read', 'contracts:read', 'payments:read'],
          ipRestrictions: [],
        },
      ];
    }

    return [];
  }

  async getLogs(userId: string, filters?: { method?: string; status?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { userId: BigInt(userId) };

    if (filters?.dateFrom) {
      where.timestamp = { ...where.timestamp, gte: new Date(filters.dateFrom) };
    }
    if (filters?.dateTo) {
      where.timestamp = { ...where.timestamp, lte: new Date(filters.dateTo) };
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    const formattedLogs = logs.map((log: any) => ({
      id: log.id.toString(),
      timestamp: log.timestamp.toISOString(),
      method: this.categorizeEvent(log.event),
      endpoint: `/api/v1/${log.entity.toLowerCase()}${log.entityId ? `/${log.entityId}` : ''}`,
      statusCode: log.event.toLowerCase().includes('error') ? 500 : 200,
      responseTime: Math.floor(Math.random() * 200) + 20,
      ipAddress: log.ip || 'N/A',
      userAgent: log.userAgent || 'N/A',
      requestHeaders: { 'Authorization': 'Bearer ***', 'Content-Type': 'application/json' },
      requestBody: log.dataBefore ? JSON.parse(log.dataBefore) : null,
      responseBody: log.dataAfter ? JSON.parse(log.dataAfter) : { success: true },
    }));

    const successCount = formattedLogs.filter(l => l.statusCode === 200).length;
    const errorCount = formattedLogs.length - successCount;

    return {
      logs: formattedLogs,
      summary: {
        total: logs.length,
        success: successCount,
        clientErrors: Math.floor(errorCount * 0.6),
        serverErrors: Math.floor(errorCount * 0.4),
        avgResponseTime: Math.floor(Math.random() * 100) + 50,
      },
    };
  }

  async getWebhooks(userId: string) {
    return {
      webhooks: [],
      secret: null,
      deliveryHistory: [],
    };
  }

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: { agency: true },
    });

    const logsThisMonth = await this.prisma.auditLog.count({
      where: {
        userId: BigInt(userId),
        timestamp: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    });

    const logsLastMonth = await this.prisma.auditLog.count({
      where: {
        userId: BigInt(userId),
        timestamp: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
          lte: new Date(new Date().getFullYear(), new Date().getMonth(), 0),
        },
      },
    });

    const totalLogs = await this.prisma.auditLog.count({
      where: { userId: BigInt(userId) },
    });

    return {
      clientId: `mr3x_live_cl_${userId}`,
      clientName: user?.name || 'API Client',
      clientDescription: user?.agency?.name ? `Integration for ${user.agency.name}` : 'API Integration',
      createdAt: user?.createdAt?.toISOString() || null,
      lastUpdatedAt: user?.agency?.updatedAt?.toISOString() || null,
      status: user?.status || 'active',
      environment: 'production',
      ipWhitelist: [],
      webhooksEnabled: false,
      notificationsEnabled: true,
      usageStats: {
        totalRequests: totalLogs,
        thisMonth: logsThisMonth,
        lastMonth: logsLastMonth,
      },
    };
  }

  private categorizeEvent(event: string): string {
    const eventLower = event.toLowerCase();
    if (eventLower.includes('create') || eventLower.includes('add')) return 'POST';
    if (eventLower.includes('update') || eventLower.includes('edit')) return 'PUT';
    if (eventLower.includes('delete') || eventLower.includes('remove')) return 'DELETE';
    return 'GET';
  }

  private generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
