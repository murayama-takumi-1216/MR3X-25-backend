import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

export interface NotificationDto {
  id: string;
  description: string;
  type: string;
  recurring: string;
  days: number;
  creationDate: Date;
  lastExecutionDate: Date | null;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  tenant?: {
    id: string;
    name: string;
    email: string;
  };
  property?: {
    id: string;
    name: string;
  };
  read: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Build where conditions based on user role
   * - Owner roles: only see notifications where they are the owner
   * - Tenant roles: only see notifications where they are the tenant
   * - Agency roles: only see notifications for their agency
   * - Admin roles: see all notifications
   */
  private buildWhereConditions(userId: bigint, agencyId?: bigint, userRole?: string): any {
    const ownerRoles = ['PROPRIETARIO', 'INDEPENDENT_OWNER'];
    const tenantRoles = ['INQUILINO'];
    const agencyRoles = ['AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'];
    const adminRoles = ['ADMIN', 'CEO'];

    if (adminRoles.includes(userRole || '')) {
      // Admins can see all notifications
      return {};
    }

    if (ownerRoles.includes(userRole || '')) {
      // Owners only see their own notifications (where they are the owner)
      return { ownerId: userId };
    }

    if (tenantRoles.includes(userRole || '')) {
      // Tenants only see their own notifications (where they are the tenant)
      return { tenantId: userId };
    }

    if (agencyRoles.includes(userRole || '') && agencyId) {
      // Agency users see notifications for their agency
      return { agencyId: agencyId };
    }

    // Default: only show notifications where user is directly involved
    return {
      OR: [
        { ownerId: userId },
        { tenantId: userId },
      ],
    };
  }

  async getNotifications(userId: bigint, agencyId?: bigint, userRole?: string): Promise<{ items: NotificationDto[]; total: number }> {
    try {
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);

      this.logger.debug(`getNotifications - userId: ${userId}, agencyId: ${agencyId}, userRole: ${userRole}`);
      this.logger.debug(`whereConditions: ${JSON.stringify(whereConditions)}`);

      const [notifications, total] = await Promise.all([
        this.prisma.notification.findMany({
          where: whereConditions,
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            tenant: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { creationDate: 'desc' },
          take: 50,
        }),
        this.prisma.notification.count({
          where: whereConditions,
        }),
      ]);

      const items: NotificationDto[] = notifications.map((n) => ({
        id: n.id.toString(),
        description: n.description,
        type: n.type,
        recurring: n.recurring,
        days: n.days,
        creationDate: n.creationDate,
        lastExecutionDate: n.lastExecutionDate,
        owner: n.owner ? {
          id: n.owner.id.toString(),
          name: n.owner.name || '',
          email: n.owner.email,
        } : undefined,
        tenant: n.tenant ? {
          id: n.tenant.id.toString(),
          name: n.tenant.name || '',
          email: n.tenant.email,
        } : undefined,
        property: n.property ? {
          id: n.property.id.toString(),
          name: n.property.name || '',
        } : undefined,
        read: n.lastExecutionDate !== null,
      }));

      return { items, total };
    } catch (error) {
      this.logger.error('Error fetching notifications:', error);
      return { items: [], total: 0 };
    }
  }

  async markAsRead(notificationId: bigint, userId: bigint, agencyId?: bigint, userRole?: string): Promise<void> {
    try {
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);

      await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          ...whereConditions,
        },
        data: {
          lastExecutionDate: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead(userId: bigint, agencyId?: bigint, userRole?: string): Promise<void> {
    try {
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);

      await this.prisma.notification.updateMany({
        where: {
          ...whereConditions,
          lastExecutionDate: null,
        },
        data: {
          lastExecutionDate: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error marking all notifications as read:', error);
    }
  }

  async getUnreadCount(userId: bigint, agencyId?: bigint, userRole?: string): Promise<number> {
    try {
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);

      return await this.prisma.notification.count({
        where: {
          ...whereConditions,
          lastExecutionDate: null,
        },
      });
    } catch (error) {
      this.logger.error('Error getting unread count:', error);
      return 0;
    }
  }

  async deleteNotification(notificationId: bigint, userId: bigint, agencyId?: bigint, userRole?: string): Promise<void> {
    try {
      const whereConditions = this.buildWhereConditions(userId, agencyId, userRole);

      await this.prisma.notification.deleteMany({
        where: {
          id: notificationId,
          ...whereConditions,
        },
      });
    } catch (error) {
      this.logger.error('Error deleting notification:', error);
    }
  }

  async createNotification(data: {
    description: string;
    ownerId: bigint;
    tenantId: bigint;
    propertyId: bigint;
    agencyId?: bigint;
    type: string;
    recurring?: string;
    days?: number;
  }): Promise<void> {
    try {
      this.logger.debug(`Creating notification - ownerId: ${data.ownerId}, tenantId: ${data.tenantId}, agencyId: ${data.agencyId}, type: ${data.type}`);

      await this.prisma.notification.create({
        data: {
          description: data.description,
          ownerId: data.ownerId,
          tenantId: data.tenantId,
          propertyId: data.propertyId,
          agencyId: data.agencyId || null,
          type: data.type,
          recurring: data.recurring || 'once',
          days: data.days || 0,
          creationDate: new Date(),
          lastExecutionDate: null,
        },
      });
      this.logger.log(`Notification created: ${data.description} (ownerId: ${data.ownerId}, tenantId: ${data.tenantId})`);
    } catch (error) {
      this.logger.error('Error creating notification:', error);
    }
  }
}
