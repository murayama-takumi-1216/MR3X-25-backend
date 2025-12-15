import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import * as crypto from 'crypto';
import * as fs from 'fs';

@Injectable()
export class ExtrajudicialNotificationHashService {
  constructor(private readonly prisma: PrismaService) {}

  generateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  generateHashFromString(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async storeProvisionalHash(notificationId: bigint, hash: string): Promise<void> {
    await this.prisma.extrajudicialNotification.update({
      where: { id: notificationId },
      data: { provisionalHash: hash },
    });
  }

  async storeFinalHash(notificationId: bigint, hash: string): Promise<void> {
    await this.prisma.extrajudicialNotification.update({
      where: { id: notificationId },
      data: { hashFinal: hash },
    });
  }

  async verifyNotificationHash(notificationId: string): Promise<{
    valid: boolean;
    message: string;
    storedHash?: string;
    calculatedHash?: string;
  }> {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: BigInt(notificationId) },
      select: {
        id: true,
        notificationToken: true,
        hashFinal: true,
        provisionalHash: true,
        finalPdfPath: true,
        provisionalPdfPath: true,
        status: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const pdfPath = notification.finalPdfPath || notification.provisionalPdfPath;
    const storedHash = notification.hashFinal || notification.provisionalHash;

    if (!pdfPath || !storedHash) {
      return {
        valid: false,
        message: 'Documento ainda nao foi gerado ou finalizado',
      };
    }

    if (!fs.existsSync(pdfPath)) {
      return {
        valid: false,
        message: 'Arquivo PDF nao encontrado no servidor',
        storedHash,
      };
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const calculatedHash = this.generateHash(pdfBuffer);

    const isValid = calculatedHash === storedHash;

    return {
      valid: isValid,
      message: isValid
        ? 'Documento valido e integro. Nenhuma alteracao detectada.'
        : 'ATENCAO: O documento foi modificado apos sua geracao. A integridade foi comprometida.',
      storedHash,
      calculatedHash,
    };
  }

  async verifyHashByToken(token: string): Promise<{
    valid: boolean;
    message: string;
    notificationToken: string;
    status: string;
    generatedAt?: string;
  }> {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { notificationToken: token },
      select: {
        id: true,
        notificationToken: true,
        hashFinal: true,
        provisionalHash: true,
        finalPdfPath: true,
        provisionalPdfPath: true,
        status: true,
        pdfGeneratedAt: true,
        createdAt: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const pdfPath = notification.finalPdfPath || notification.provisionalPdfPath;
    const storedHash = notification.hashFinal || notification.provisionalHash;

    if (!pdfPath || !storedHash) {
      return {
        valid: false,
        message: 'Documento ainda nao foi gerado ou finalizado',
        notificationToken: notification.notificationToken,
        status: notification.status,
      };
    }

    if (!fs.existsSync(pdfPath)) {
      return {
        valid: false,
        message: 'Arquivo PDF nao encontrado no servidor',
        notificationToken: notification.notificationToken,
        status: notification.status,
      };
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const calculatedHash = this.generateHash(pdfBuffer);
    const isValid = calculatedHash === storedHash;

    return {
      valid: isValid,
      message: isValid
        ? 'Documento valido e integro. Nenhuma alteracao detectada.'
        : 'ATENCAO: O documento foi modificado apos sua geracao.',
      notificationToken: notification.notificationToken,
      status: notification.status,
      generatedAt: notification.pdfGeneratedAt?.toISOString() || notification.createdAt?.toISOString(),
    };
  }

  async validateUploadedPdf(
    notificationToken: string,
    fileBuffer: Buffer,
  ): Promise<{
    valid: boolean;
    message: string;
  }> {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { notificationToken },
      select: {
        hashFinal: true,
        provisionalHash: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const storedHash = notification.hashFinal || notification.provisionalHash;

    if (!storedHash) {
      return {
        valid: false,
        message: 'Hash do documento original nao encontrado',
      };
    }

    const uploadedHash = this.generateHash(fileBuffer);
    const isValid = uploadedHash === storedHash;

    return {
      valid: isValid,
      message: isValid
        ? 'O documento enviado corresponde ao original. Integridade confirmada.'
        : 'ATENCAO: O documento enviado NAO corresponde ao original registrado no sistema.',
    };
  }
}
