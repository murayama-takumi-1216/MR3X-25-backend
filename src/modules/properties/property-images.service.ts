import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PropertyImagesService {
  constructor(private prisma: PrismaService) {}

  async uploadImages(
    propertyId: string,
    user: { sub: string; role: string; agencyId?: string | null },
    files: Express.Multer.File[]
  ) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const hasAccess = this.checkPropertyAccess(property, user);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const uploadedImages: any[] = [];

    for (const file of files) {
      const image = await this.prisma.propertyImage.create({
        data: {
          propertyId: BigInt(propertyId),
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path,
          uploadedBy: BigInt(user.sub),
        },
      });

      uploadedImages.push(this.serializeImage(image));
    }

    return uploadedImages;
  }

  async getPropertyImages(
    propertyId: string,
    user: { sub: string; role: string; agencyId?: string | null }
  ) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const hasAccess = this.checkPropertyAccess(property, user);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const images = await this.prisma.propertyImage.findMany({
      where: {
        propertyId: BigInt(propertyId),
      },
      orderBy: [
        { isPrimary: 'desc' },
        { uploadedAt: 'asc' },
      ],
    });

    return images.map(img => this.serializeImage(img));
  }

  async getPropertyImagesPublic(propertyId: string) {
    const images = await this.prisma.propertyImage.findMany({
      where: {
        propertyId: BigInt(propertyId),
      },
      orderBy: [
        { isPrimary: 'desc' },
        { uploadedAt: 'asc' },
      ],
    });

    return images.map(img => this.serializeImage(img));
  }

  async setPrimaryImage(
    propertyId: string,
    imageId: string,
    user: { sub: string; role: string; agencyId?: string | null }
  ) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const hasAccess = this.checkPropertyAccess(property, user);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const image = await this.prisma.propertyImage.findFirst({
      where: {
        id: BigInt(imageId),
        propertyId: BigInt(propertyId),
      },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.propertyImage.updateMany({
      where: {
        propertyId: BigInt(propertyId),
      },
      data: {
        isPrimary: false,
      },
    });

    const updatedImage = await this.prisma.propertyImage.update({
      where: {
        id: BigInt(imageId),
      },
      data: {
        isPrimary: true,
      },
    });

    return this.serializeImage(updatedImage);
  }

  async deleteImage(
    propertyId: string,
    imageId: string,
    user: { sub: string; role: string; agencyId?: string | null }
  ) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const hasAccess = this.checkPropertyAccess(property, user);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    const image = await this.prisma.propertyImage.findFirst({
      where: {
        id: BigInt(imageId),
        propertyId: BigInt(propertyId),
      },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    try {
      if (fs.existsSync(image.path)) {
        fs.unlinkSync(image.path);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    await this.prisma.propertyImage.delete({
      where: {
        id: BigInt(imageId),
      },
    });

    if (image.isPrimary) {
      const remainingImages = await this.prisma.propertyImage.findMany({
        where: {
          propertyId: BigInt(propertyId),
        },
        orderBy: {
          uploadedAt: 'asc',
        },
        take: 1,
      });

      if (remainingImages.length > 0) {
        await this.prisma.propertyImage.update({
          where: {
            id: remainingImages[0].id,
          },
          data: {
            isPrimary: true,
          },
        });
      }
    }

    return { success: true };
  }

  private checkPropertyAccess(
    property: any,
    user: { sub: string; role: string; agencyId?: string | null }
  ): boolean {
    const hasPlatformAccess = user.role === 'CEO' || user.role === 'ADMIN';

    const isSameAgency = Boolean(
      property.agencyId &&
      user.agencyId &&
      property.agencyId.toString() === user.agencyId
    );

    const hasAgencyAdminAccess = isSameAgency && user.role === 'AGENCY_ADMIN';

    const hasManagerAccess = isSameAgency && user.role === 'AGENCY_MANAGER';

    const hasBrokerAccess = Boolean(
      user.role === 'BROKER' && (
        (property.brokerId && property.brokerId.toString() === user.sub) ||
        isSameAgency
      )
    );

    const hasProprietarioAccess = isSameAgency && user.role === 'PROPRIETARIO';

    const hasIndependentOwnerAccess = user.role === 'INDEPENDENT_OWNER' && property.ownerId?.toString() === user.sub;

    const isOwner = property.ownerId?.toString() === user.sub;

    return isOwner || hasAgencyAdminAccess || hasManagerAccess || hasBrokerAccess || hasProprietarioAccess || hasIndependentOwnerAccess || hasPlatformAccess;
  }

  private serializeImage(image: any) {
    return {
      id: image.id.toString(),
      propertyId: image.propertyId.toString(),
      filename: image.filename,
      originalName: image.originalName,
      mimeType: image.mimeType,
      size: image.size,
      path: image.path,
      isPrimary: image.isPrimary,
      uploadedAt: image.uploadedAt?.toISOString() || null,
      uploadedBy: image.uploadedBy.toString(),
    };
  }
}
