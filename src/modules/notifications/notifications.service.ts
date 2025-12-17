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

  async getNotifications(userId: bigint, agencyId?: bigint): Promise<{ items: NotificationDto[]; total: number }> {
    try {
      // Build OR conditions based on user type
      const orConditions: any[] = [
        { ownerId: userId },
        { tenantId: userId },
      ];

      // If user has an agencyId, also get notifications for their agency
      if (agencyId) {
        orConditions.push({ agencyId: agencyId });
      }

      const [notifications, total] = await Promise.all([
        this.prisma.notification.findMany({
          where: {
            OR: orConditions,
          },
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
          where: {
            OR: orConditions,
          },
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

  async markAsRead(notificationId: bigint, userId: bigint, agencyId?: bigint): Promise<void> {
    try {
      const orConditions: any[] = [
        { ownerId: userId },
        { tenantId: userId },
      ];
      if (agencyId) {
        orConditions.push({ agencyId: agencyId });
      }

      await this.prisma.notification.updateMany({
        where: {
          id: notificationId,
          OR: orConditions,
        },
        data: {
          lastExecutionDate: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead(userId: bigint, agencyId?: bigint): Promise<void> {
    try {
      const orConditions: any[] = [
        { ownerId: userId },
        { tenantId: userId },
      ];
      if (agencyId) {
        orConditions.push({ agencyId: agencyId });
      }

      await this.prisma.notification.updateMany({
        where: {
          OR: orConditions,
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

  async getUnreadCount(userId: bigint, agencyId?: bigint): Promise<number> {
    try {
      const orConditions: any[] = [
        { ownerId: userId },
        { tenantId: userId },
      ];
      if (agencyId) {
        orConditions.push({ agencyId: agencyId });
      }

      return await this.prisma.notification.count({
        where: {
          OR: orConditions,
          lastExecutionDate: null,
        },
      });
    } catch (error) {
      this.logger.error('Error getting unread count:', error);
      return 0;
    }
  }

  async deleteNotification(notificationId: bigint, userId: bigint, agencyId?: bigint): Promise<void> {
    try {
      const orConditions: any[] = [
        { ownerId: userId },
        { tenantId: userId },
      ];
      if (agencyId) {
        orConditions.push({ agencyId: agencyId });
      }

      await this.prisma.notification.deleteMany({
        where: {
          id: notificationId,
          OR: orConditions,
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
      this.logger.log(`Notification created: ${data.description}`);
    } catch (error) {
      this.logger.error('Error creating notification:', error);
    }
  }
}
