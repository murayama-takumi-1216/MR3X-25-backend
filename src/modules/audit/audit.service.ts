import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async getAuditLogs(params: {
    entity?: string;
    entityId?: string;
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;

    const where: any = {};

    if (params.entity) {
      where.entity = params.entity;
    }

    if (params.entityId) {
      where.entityId = BigInt(params.entityId);
    }

    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) {
        where.timestamp.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.timestamp.lte = new Date(params.endDate);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const itemsWithNullSafeUsers = items.map(item => ({
      id: item.id.toString(),
      event: item.event,
      entity: item.entity,
      entityId: item.entityId?.toString() || null,
      dataBefore: item.dataBefore,
      dataAfter: item.dataAfter,
      ip: item.ip,
      userAgent: item.userAgent,
      timestamp: item.timestamp,
      user: item.user
        ? {
            id: item.user.id.toString(),
            name: item.user.name,
            email: item.user.email,
            role: item.user.role,
          }
        : {
            id: '0',
            name: 'Deleted User',
            email: 'unknown@deleted.com',
            role: 'UNKNOWN',
          },
    }));

    return { items: itemsWithNullSafeUsers, total, page, pageSize };
  }

  async getAuditLogById(id: string) {
    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id: BigInt(id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    return {
      id: auditLog.id.toString(),
      event: auditLog.event,
      entity: auditLog.entity,
      entityId: auditLog.entityId?.toString() || null,
      dataBefore: auditLog.dataBefore,
      dataAfter: auditLog.dataAfter,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      timestamp: auditLog.timestamp,
      user: auditLog.user
        ? {
            id: auditLog.user.id.toString(),
            name: auditLog.user.name,
            email: auditLog.user.email,
            role: auditLog.user.role,
          }
        : {
            id: '0',
            name: 'Deleted User',
            email: 'unknown@deleted.com',
            role: 'UNKNOWN',
          },
    };
  }

  async createAuditLog(data: {
    event: string;
    userId: string;
    entity: string;
    entityId: string;
    dataBefore?: string;
    dataAfter?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const auditLog = await this.prisma.auditLog.create({
      data: {
        event: data.event,
        userId: BigInt(data.userId),
        entity: data.entity,
        entityId: BigInt(data.entityId),
        dataBefore: data.dataBefore,
        dataAfter: data.dataAfter,
        ip: data.ip,
        userAgent: data.userAgent,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return {
      id: auditLog.id.toString(),
      event: auditLog.event,
      entity: auditLog.entity,
      entityId: auditLog.entityId?.toString() || null,
      dataBefore: auditLog.dataBefore,
      dataAfter: auditLog.dataAfter,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      timestamp: auditLog.timestamp,
      user: auditLog.user
        ? {
            id: auditLog.user.id.toString(),
            name: auditLog.user.name,
            email: auditLog.user.email,
            role: auditLog.user.role,
          }
        : null,
    };
  }
}
