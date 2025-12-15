import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import { InspectionSignatureLinkService } from './inspection-signature-link.service';
import { InspectionPdfService } from './inspection-pdf.service';

export interface SignatureData {
  signature: string;
  clientIP?: string;
  userAgent?: string;
  geoLat?: number;
  geoLng?: number;
  geoConsent?: boolean;
}

export interface SignInspectionResult {
  success: boolean;
  inspectionId: string;
  signerType: string;
  signedAt: Date;
  allSignaturesComplete: boolean;
}

@Injectable()
export class InspectionSignatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signatureLinkService: InspectionSignatureLinkService,
    private readonly pdfService: InspectionPdfService,
  ) {}

  async signInspection(
    inspectionId: string,
    signerType: 'tenant' | 'owner' | 'agency' | 'inspector',
    signatureData: SignatureData,
    userId: string,
  ): Promise<SignInspectionResult> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
      include: {
        property: {
          include: {
            owner: true,
            tenant: true,
          },
        },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    if (inspection.status === 'APROVADA') {
      throw new ForbiddenException('Vistoria ja foi aprovada e nao pode ser alterada');
    }

    const signatureField = `${signerType}Signature`;
    if ((inspection as any)[signatureField]) {
      throw new BadRequestException(`Esta vistoria ja foi assinada pelo ${this.getSignerTypeLabel(signerType)}`);
    }

    if (!signatureData.signature) {
      throw new BadRequestException('Assinatura e obrigatoria');
    }

    if (!signatureData.geoLat || !signatureData.geoLng) {
      throw new BadRequestException('Geolocalizacao e obrigatoria para assinatura');
    }

    const now = new Date();

    const updateData: any = {
      [`${signerType}Signature`]: signatureData.signature,
      [`${signerType}SignedAt`]: now,
      [`${signerType}SignedIP`]: signatureData.clientIP || null,
      [`${signerType}SignedAgent`]: signatureData.userAgent || null,
      [`${signerType}GeoLat`]: signatureData.geoLat,
      [`${signerType}GeoLng`]: signatureData.geoLng,
      [`${signerType}GeoConsent`]: signatureData.geoConsent || false,
    };

    if (inspection.status === 'RASCUNHO' || inspection.status === 'EM_ANDAMENTO') {
      updateData.status = 'AGUARDANDO_ASSINATURA';
    }

    await this.prisma.inspection.update({
      where: { id: BigInt(inspectionId) },
      data: updateData,
    });

    await this.createAuditLog(BigInt(inspectionId), `SIGNED_BY_${signerType.toUpperCase()}`, BigInt(userId), {
      signerType,
      signedAt: now.toISOString(),
      clientIP: signatureData.clientIP,
      geoLat: signatureData.geoLat,
      geoLng: signatureData.geoLng,
    });

    const allSignaturesComplete = await this.checkAllSignaturesComplete(BigInt(inspectionId));

    return {
      success: true,
      inspectionId,
      signerType,
      signedAt: now,
      allSignaturesComplete,
    };
  }

  async signInspectionViaLink(
    linkToken: string,
    signatureData: SignatureData,
  ): Promise<SignInspectionResult> {
    const validation = await this.signatureLinkService.validateSignatureLink(linkToken);

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    if (!signatureData.geoLat || !signatureData.geoLng) {
      throw new BadRequestException('Geolocalizacao e obrigatoria para assinatura externa');
    }

    if (!signatureData.geoConsent) {
      throw new BadRequestException('Consentimento de geolocalizacao e obrigatorio');
    }

    const inspectionId = validation.inspectionId!;
    const signerType = validation.signerType!.toLowerCase() as 'tenant' | 'owner' | 'agency' | 'inspector';

    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    const signatureField = `${signerType}Signature`;
    if ((inspection as any)[signatureField]) {
      throw new BadRequestException(`Esta vistoria ja foi assinada pelo ${this.getSignerTypeLabel(signerType)}`);
    }

    const now = new Date();

    const updateData: any = {
      [`${signerType}Signature`]: signatureData.signature,
      [`${signerType}SignedAt`]: now,
      [`${signerType}SignedIP`]: signatureData.clientIP || null,
      [`${signerType}SignedAgent`]: signatureData.userAgent || null,
      [`${signerType}GeoLat`]: signatureData.geoLat,
      [`${signerType}GeoLng`]: signatureData.geoLng,
      [`${signerType}GeoConsent`]: signatureData.geoConsent || false,
    };

    if (inspection.status === 'RASCUNHO' || inspection.status === 'EM_ANDAMENTO') {
      updateData.status = 'AGUARDANDO_ASSINATURA';
    }

    await this.prisma.inspection.update({
      where: { id: BigInt(inspectionId) },
      data: updateData,
    });

    await this.signatureLinkService.markLinkUsed(linkToken);

    await this.createAuditLog(BigInt(inspectionId), `SIGNED_BY_${signerType.toUpperCase()}_VIA_LINK`, BigInt(0), {
      signerType,
      signerEmail: validation.signerEmail,
      signedAt: now.toISOString(),
      clientIP: signatureData.clientIP,
      geoLat: signatureData.geoLat,
      geoLng: signatureData.geoLng,
      linkToken,
    });

    const allSignaturesComplete = await this.checkAllSignaturesComplete(BigInt(inspectionId));

    return {
      success: true,
      inspectionId,
      signerType,
      signedAt: now,
      allSignaturesComplete,
    };
  }

  async checkAllSignaturesComplete(inspectionId: bigint): Promise<boolean> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: {
        inspectorSignature: true,
        tenantSignature: true,
        ownerSignature: true,
        agencyId: true,
        agencySignature: true,
        property: {
          select: {
            tenantId: true,
            ownerId: true,
          },
        },
      },
    });

    if (!inspection) {
      return false;
    }

    if (!inspection.inspectorSignature) {
      return false;
    }

    if (inspection.property.ownerId && !inspection.ownerSignature) {
      return false;
    }

    if (inspection.property.tenantId && !inspection.tenantSignature) {
      return false;
    }

    if (inspection.agencyId && !inspection.agencySignature) {
      return false;
    }

    return true;
  }

  async getSignatureStatus(inspectionId: string): Promise<{
    inspectorSigned: boolean;
    tenantSigned: boolean;
    ownerSigned: boolean;
    agencySigned: boolean;
    allComplete: boolean;
    requiredSignatures: string[];
    pendingSignatures: string[];
  }> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
      select: {
        inspectorSignature: true,
        inspectorSignedAt: true,
        tenantSignature: true,
        tenantSignedAt: true,
        ownerSignature: true,
        ownerSignedAt: true,
        agencySignature: true,
        agencySignedAt: true,
        agencyId: true,
        property: {
          select: {
            tenantId: true,
            ownerId: true,
          },
        },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    const requiredSignatures: string[] = ['inspector'];
    const pendingSignatures: string[] = [];

    if (!inspection.inspectorSignature) {
      pendingSignatures.push('inspector');
    }

    if (inspection.property.ownerId) {
      requiredSignatures.push('owner');
      if (!inspection.ownerSignature) {
        pendingSignatures.push('owner');
      }
    }

    if (inspection.property.tenantId) {
      requiredSignatures.push('tenant');
      if (!inspection.tenantSignature) {
        pendingSignatures.push('tenant');
      }
    }

    if (inspection.agencyId) {
      requiredSignatures.push('agency');
      if (!inspection.agencySignature) {
        pendingSignatures.push('agency');
      }
    }

    return {
      inspectorSigned: !!inspection.inspectorSignature,
      tenantSigned: !!inspection.tenantSignature,
      ownerSigned: !!inspection.ownerSignature,
      agencySigned: !!inspection.agencySignature,
      allComplete: pendingSignatures.length === 0,
      requiredSignatures,
      pendingSignatures,
    };
  }

  async finalizeInspection(inspectionId: string, userId: string): Promise<void> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    if (inspection.status === 'APROVADA') {
      throw new BadRequestException('Vistoria ja foi aprovada');
    }

    const allComplete = await this.checkAllSignaturesComplete(BigInt(inspectionId));

    if (!allComplete) {
      throw new BadRequestException('Nem todas as assinaturas obrigatorias foram coletadas');
    }

    await this.pdfService.generateFinalPdf(BigInt(inspectionId));

    await this.prisma.inspection.update({
      where: { id: BigInt(inspectionId) },
      data: { status: 'CONCLUIDA' },
    });

    await this.createAuditLog(BigInt(inspectionId), 'FINALIZED', BigInt(userId), {
      finalizedAt: new Date().toISOString(),
    });
  }

  async approveInspection(inspectionId: string, userId: string): Promise<void> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria nao encontrada');
    }

    if (inspection.status === 'APROVADA') {
      throw new BadRequestException('Vistoria ja foi aprovada');
    }

    if (!inspection.hashFinal) {
      await this.pdfService.generateFinalPdf(BigInt(inspectionId));
    }

    await this.prisma.inspection.update({
      where: { id: BigInt(inspectionId) },
      data: {
        status: 'APROVADA',
        approvedById: BigInt(userId),
        approvedAt: new Date(),
      },
    });

    await this.createAuditLog(BigInt(inspectionId), 'APPROVED', BigInt(userId), {
      approvedAt: new Date().toISOString(),
    });
  }

  private async createAuditLog(
    inspectionId: bigint,
    action: string,
    performedBy: bigint,
    details: any,
  ): Promise<void> {
    await this.prisma.inspectionAudit.create({
      data: {
        inspectionId,
        action,
        performedBy,
        details: JSON.stringify(details),
      },
    });
  }

  private getSignerTypeLabel(signerType: string): string {
    const labels: Record<string, string> = {
      tenant: 'Inquilino',
      owner: 'Proprietario',
      agency: 'Imobiliaria',
      inspector: 'Vistoriador',
    };
    return labels[signerType] || signerType;
  }

  async getAuditLog(inspectionId: string): Promise<any[]> {
    const logs = await this.prisma.inspectionAudit.findMany({
      where: { inspectionId: BigInt(inspectionId) },
      orderBy: { performedAt: 'desc' },
    });

    return logs.map((log) => ({
      id: log.id.toString(),
      action: log.action,
      performedBy: log.performedBy.toString(),
      performedAt: log.performedAt,
      details: log.details ? JSON.parse(log.details) : null,
    }));
  }
}
