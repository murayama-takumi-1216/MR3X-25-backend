import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import { randomUUID } from 'crypto';

export interface SignatureLinkResult {
  token: string;
  signerType: string;
  signerEmail: string;
  expiresAt: Date;
  signatureUrl: string;
}

export interface ValidateSignatureLinkResult {
  valid: boolean;
  contractId?: string;
  signerType?: string;
  signerEmail?: string;
  signerName?: string;
  expired?: boolean;
  used?: boolean;
  message: string;
}

@Injectable()
export class SignatureLinkService {
  private readonly defaultExpiryHours = 48;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a signature invitation link
   */
  async createSignatureLink(
    contractId: bigint,
    signerType: 'tenant' | 'owner' | 'agency' | 'witness',
    signerEmail: string,
    signerName?: string,
    expiresInHours: number = this.defaultExpiryHours,
  ): Promise<SignatureLinkResult> {
    // Verify contract exists and is in pending_signatures status
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, contractToken: true },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    // Check if there's already an active link for this signer type
    const existingLink = await this.prisma.signatureLink.findFirst({
      where: {
        contractId,
        signerType,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingLink) {
      // Return existing link if still valid
      const signatureUrl = this.getSignatureUrl(existingLink.token);
      return {
        token: existingLink.token,
        signerType: existingLink.signerType,
        signerEmail: existingLink.signerEmail,
        expiresAt: existingLink.expiresAt,
        signatureUrl,
      };
    }

    // Generate new token
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Create signature link
    const link = await this.prisma.signatureLink.create({
      data: {
        contractId,
        signerType,
        signerEmail,
        signerName,
        token,
        expiresAt,
      },
    });

    const signatureUrl = this.getSignatureUrl(token);

    return {
      token: link.token,
      signerType: link.signerType,
      signerEmail: link.signerEmail,
      expiresAt: link.expiresAt,
      signatureUrl,
    };
  }

  /**
   * Validate a signature link
   */
  async validateSignatureLink(token: string): Promise<ValidateSignatureLinkResult> {
    const link = await this.prisma.signatureLink.findUnique({
      where: { token },
      include: {
        contract: {
          select: {
            id: true,
            status: true,
            contractToken: true,
          },
        },
      },
    });

    if (!link) {
      return {
        valid: false,
        message: 'Link de assinatura não encontrado ou inválido',
      };
    }

    // Check if already used
    if (link.usedAt) {
      return {
        valid: false,
        used: true,
        message: 'Este link de assinatura já foi utilizado',
      };
    }

    // Check if expired
    if (new Date() > link.expiresAt) {
      return {
        valid: false,
        expired: true,
        message: 'Este link de assinatura expirou',
      };
    }

    return {
      valid: true,
      contractId: link.contractId.toString(),
      signerType: link.signerType,
      signerEmail: link.signerEmail,
      signerName: link.signerName || undefined,
      message: 'Link válido',
    };
  }

  /**
   * Mark a signature link as used
   */
  async markLinkUsed(token: string): Promise<void> {
    const link = await this.prisma.signatureLink.findUnique({
      where: { token },
    });

    if (!link) {
      throw new NotFoundException('Link de assinatura não encontrado');
    }

    if (link.usedAt) {
      throw new BadRequestException('Este link já foi utilizado');
    }

    await this.prisma.signatureLink.update({
      where: { token },
      data: { usedAt: new Date() },
    });
  }

  /**
   * Mark a signature link as sent
   */
  async markLinkSent(token: string): Promise<void> {
    await this.prisma.signatureLink.update({
      where: { token },
      data: { sentAt: new Date() },
    });
  }

  /**
   * Get all signature links for a contract
   */
  async getContractSignatureLinks(contractId: bigint): Promise<any[]> {
    const links = await this.prisma.signatureLink.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      id: link.id.toString(),
      signerType: link.signerType,
      signerEmail: link.signerEmail,
      signerName: link.signerName,
      expiresAt: link.expiresAt,
      usedAt: link.usedAt,
      sentAt: link.sentAt,
      isExpired: new Date() > link.expiresAt,
      isUsed: !!link.usedAt,
      signatureUrl: this.getSignatureUrl(link.token),
    }));
  }

  /**
   * Revoke a signature link
   */
  async revokeSignatureLink(token: string): Promise<void> {
    await this.prisma.signatureLink.update({
      where: { token },
      data: { expiresAt: new Date() }, // Set expiry to now
    });
  }

  /**
   * Revoke all signature links for a contract
   */
  async revokeAllContractLinks(contractId: bigint): Promise<void> {
    await this.prisma.signatureLink.updateMany({
      where: {
        contractId,
        usedAt: null,
      },
      data: { expiresAt: new Date() },
    });
  }

  /**
   * Get the signature URL for a token
   */
  private getSignatureUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${baseUrl}/sign/${token}`;
  }

  /**
   * Create signature links for all required parties
   */
  async createSignatureLinksForContract(
    contractId: bigint,
    parties: Array<{
      signerType: 'tenant' | 'owner' | 'agency' | 'witness';
      email: string;
      name?: string;
    }>,
    expiresInHours: number = this.defaultExpiryHours,
  ): Promise<SignatureLinkResult[]> {
    const results: SignatureLinkResult[] = [];

    for (const party of parties) {
      const link = await this.createSignatureLink(
        contractId,
        party.signerType,
        party.email,
        party.name,
        expiresInHours,
      );
      results.push(link);
    }

    return results;
  }

  /**
   * Get contract data for external signing page
   */
  async getContractDataForSigning(token: string): Promise<any> {
    const validation = await this.validateSignatureLink(token);

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(validation.contractId!) },
      include: {
        property: {
          select: {
            address: true,
            city: true,
            neighborhood: true,
          },
        },
        tenantUser: {
          select: {
            name: true,
            email: true,
          },
        },
        ownerUser: {
          select: {
            name: true,
            email: true,
          },
        },
        agency: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    // Return only necessary data for signing page (no sensitive info)
    return {
      contractToken: contract.contractToken,
      signerType: validation.signerType,
      signerEmail: validation.signerEmail,
      signerName: validation.signerName,
      property: {
        address: contract.property.address,
        city: contract.property.city,
        neighborhood: contract.property.neighborhood,
      },
      parties: {
        tenant: contract.tenantUser.name,
        owner: contract.ownerUser?.name,
        agency: contract.agency?.name,
      },
      monthlyRent: Number(contract.monthlyRent),
      startDate: contract.startDate,
      endDate: contract.endDate,
      status: contract.status,
    };
  }
}
