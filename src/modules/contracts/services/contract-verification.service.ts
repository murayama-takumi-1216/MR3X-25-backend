import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import { ContractHashService } from './contract-hash.service';
import * as QRCode from 'qrcode';
import * as bwipjs from 'bwip-js';

export interface VerificationData {
  token: string;
  hash: string | null;
  status: string;
  createdAt: string;
  signedAt: string | null;
  verificationUrl: string;
  isValid: boolean;
  signatures: {
    tenant: SignatureInfo | null;
    owner: SignatureInfo | null;
    agency: SignatureInfo | null;
    witness: SignatureInfo | null;
  };
  property: {
    city: string;
    neighborhood: string;
  };
}

export interface SignatureInfo {
  signedAt: string;
  hasGeo: boolean;
  hasIP: boolean;
}

export interface QRCodeData {
  dataUrl: string;
  rawData: string;
}

export interface BarcodeData {
  dataUrl: string;
  token: string;
}

export interface VerificationResult {
  valid: boolean;
  message: string;
  details: {
    tokenValid: boolean;
    hashValid: boolean;
    signaturesValid: boolean;
    contractActive: boolean;
  };
  contract?: VerificationData;
}

@Injectable()
export class ContractVerificationService {
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: ContractHashService,
  ) {
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  generateVerificationUrl(token: string): string {
    return `${this.frontendUrl}/verify/${token}`;
  }

  async generateVerificationQRCode(contractId: bigint): Promise<QRCodeData> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        contractToken: true,
        hashFinal: true,
        status: true,
      },
    });

    if (!contract || !contract.contractToken) {
      throw new NotFoundException('Contrato não encontrado ou sem token');
    }

    const verificationData = {
      t: contract.contractToken,
      h: contract.hashFinal ? contract.hashFinal.substring(0, 16) : null,
      s: contract.status,
      v: '1',
    };

    const verificationUrl = this.generateVerificationUrl(contract.contractToken);
    const qrData = `${verificationUrl}?d=${Buffer.from(JSON.stringify(verificationData)).toString('base64')}`;

    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });

    return {
      dataUrl: qrDataUrl,
      rawData: qrData,
    };
  }

  async generateVerificationBarcode(contractId: bigint): Promise<BarcodeData> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { contractToken: true },
    });

    if (!contract || !contract.contractToken) {
      throw new NotFoundException('Contrato não encontrado ou sem token');
    }

    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: contract.contractToken,
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: 'center',
      textsize: 10,
    });

    return {
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      token: contract.contractToken,
    };
  }

  async verifyByToken(token: string): Promise<VerificationResult> {
    const contract = await this.prisma.contract.findUnique({
      where: { contractToken: token },
      include: {
        property: {
          select: { city: true, neighborhood: true },
        },
      },
    });

    if (!contract) {
      return {
        valid: false,
        message: 'Contrato não encontrado',
        details: {
          tokenValid: false,
          hashValid: false,
          signaturesValid: false,
          contractActive: false,
        },
      };
    }

    if (contract.deleted) {
      return {
        valid: false,
        message: 'Contrato foi excluído',
        details: {
          tokenValid: true,
          hashValid: false,
          signaturesValid: false,
          contractActive: false,
        },
      };
    }

    const hasRequiredSignatures = !!(contract.tenantSignature && contract.ownerSignature);
    const contractActive = ['ATIVO', 'ASSINADO'].includes(contract.status);

    const verificationData: VerificationData = {
      token: contract.contractToken!,
      hash: contract.hashFinal,
      status: contract.status,
      createdAt: contract.createdAt.toISOString(),
      signedAt: contract.tenantSignedAt?.toISOString() || null,
      verificationUrl: this.generateVerificationUrl(token),
      isValid: hasRequiredSignatures && contractActive,
      signatures: {
        tenant: contract.tenantSignature
          ? {
              signedAt: contract.tenantSignedAt!.toISOString(),
              hasGeo: !!(contract.tenantGeoLat && contract.tenantGeoLng),
              hasIP: !!contract.tenantSignedIP,
            }
          : null,
        owner: contract.ownerSignature
          ? {
              signedAt: contract.ownerSignedAt!.toISOString(),
              hasGeo: !!(contract.ownerGeoLat && contract.ownerGeoLng),
              hasIP: !!contract.ownerSignedIP,
            }
          : null,
        agency: contract.agencySignature
          ? {
              signedAt: contract.agencySignedAt!.toISOString(),
              hasGeo: !!(contract.agencyGeoLat && contract.agencyGeoLng),
              hasIP: !!contract.agencySignedIP,
            }
          : null,
        witness: contract.witnessSignature
          ? {
              signedAt: contract.witnessSignedAt!.toISOString(),
              hasGeo: !!(contract.witnessGeoLat && contract.witnessGeoLng),
              hasIP: false,
            }
          : null,
      },
      property: {
        city: contract.property.city,
        neighborhood: contract.property.neighborhood,
      },
    };

    return {
      valid: hasRequiredSignatures && contractActive,
      message: this.getVerificationMessage(contract.status, hasRequiredSignatures),
      details: {
        tokenValid: true,
        hashValid: !!contract.hashFinal,
        signaturesValid: hasRequiredSignatures,
        contractActive,
      },
      contract: verificationData,
    };
  }

  async verifyByHash(hash: string): Promise<VerificationResult> {
    const contract = await this.prisma.contract.findFirst({
      where: { hashFinal: hash },
      include: {
        property: {
          select: { city: true, neighborhood: true },
        },
      },
    });

    if (!contract) {
      return {
        valid: false,
        message: 'Nenhum contrato encontrado com este hash',
        details: {
          tokenValid: false,
          hashValid: false,
          signaturesValid: false,
          contractActive: false,
        },
      };
    }

    return this.verifyByToken(contract.contractToken!);
  }

  async verifyUploadedPdf(token: string, fileBuffer: Buffer): Promise<{
    valid: boolean;
    computedHash: string;
    storedHash: string | null;
    message: string;
    contract: VerificationData | null;
  }> {
    const contract = await this.prisma.contract.findUnique({
      where: { contractToken: token },
      include: {
        property: {
          select: { city: true, neighborhood: true },
        },
      },
    });

    const computedHash = this.hashService.generateHash(fileBuffer);

    if (!contract) {
      return {
        valid: false,
        computedHash,
        storedHash: null,
        message: 'Contrato não encontrado',
        contract: null,
      };
    }

    if (!contract.hashFinal) {
      return {
        valid: false,
        computedHash,
        storedHash: null,
        message: 'Contrato ainda não possui hash final (não finalizado)',
        contract: null,
      };
    }

    const isValid = contract.hashFinal === computedHash;

    const verificationData: VerificationData = {
      token: contract.contractToken!,
      hash: contract.hashFinal,
      status: contract.status,
      createdAt: contract.createdAt.toISOString(),
      signedAt: contract.tenantSignedAt?.toISOString() || null,
      verificationUrl: this.generateVerificationUrl(token),
      isValid,
      signatures: {
        tenant: contract.tenantSignature
          ? {
              signedAt: contract.tenantSignedAt!.toISOString(),
              hasGeo: !!(contract.tenantGeoLat && contract.tenantGeoLng),
              hasIP: !!contract.tenantSignedIP,
            }
          : null,
        owner: contract.ownerSignature
          ? {
              signedAt: contract.ownerSignedAt!.toISOString(),
              hasGeo: !!(contract.ownerGeoLat && contract.ownerGeoLng),
              hasIP: !!contract.ownerSignedIP,
            }
          : null,
        agency: contract.agencySignature
          ? {
              signedAt: contract.agencySignedAt!.toISOString(),
              hasGeo: !!(contract.agencyGeoLat && contract.agencyGeoLng),
              hasIP: !!contract.agencySignedIP,
            }
          : null,
        witness: contract.witnessSignature
          ? {
              signedAt: contract.witnessSignedAt!.toISOString(),
              hasGeo: !!(contract.witnessGeoLat && contract.witnessGeoLng),
              hasIP: false,
            }
          : null,
      },
      property: {
        city: contract.property.city,
        neighborhood: contract.property.neighborhood,
      },
    };

    return {
      valid: isValid,
      computedHash,
      storedHash: contract.hashFinal,
      message: isValid
        ? '✓ Documento autêntico - O hash corresponde ao original'
        : '✗ ALERTA: Documento foi modificado - O hash não corresponde ao original',
      contract: verificationData,
    };
  }

  async generateVerificationCertificate(contractId: bigint): Promise<{
    certificate: object;
    qrCode: QRCodeData;
    barcode: BarcodeData;
  }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        property: { select: { address: true, city: true, neighborhood: true } },
        tenantUser: { select: { name: true } },
        ownerUser: { select: { name: true } },
        agency: { select: { name: true } },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    const qrCode = await this.generateVerificationQRCode(contractId);
    const barcode = await this.generateVerificationBarcode(contractId);

    const certificate = {
      documentType: 'Contrato de Locação',
      token: contract.contractToken,
      hashSHA256: contract.hashFinal,
      status: contract.status,
      createdAt: contract.createdAt.toISOString(),
      property: {
        address: contract.property.address,
        city: contract.property.city,
        neighborhood: contract.property.neighborhood,
      },
      parties: {
        tenant: contract.tenantUser?.name || 'N/A',
        owner: contract.ownerUser?.name || 'N/A',
        agency: contract.agency?.name || null,
      },
      signatures: {
        tenant: contract.tenantSignature
          ? {
              signedAt: contract.tenantSignedAt?.toISOString(),
              ip: contract.tenantSignedIP,
              geolocation: contract.tenantGeoLat
                ? { lat: contract.tenantGeoLat, lng: contract.tenantGeoLng }
                : null,
            }
          : null,
        owner: contract.ownerSignature
          ? {
              signedAt: contract.ownerSignedAt?.toISOString(),
              ip: contract.ownerSignedIP,
              geolocation: contract.ownerGeoLat
                ? { lat: contract.ownerGeoLat, lng: contract.ownerGeoLng }
                : null,
            }
          : null,
        agency: contract.agencySignature
          ? {
              signedAt: contract.agencySignedAt?.toISOString(),
              ip: contract.agencySignedIP,
              geolocation: contract.agencyGeoLat
                ? { lat: contract.agencyGeoLat, lng: contract.agencyGeoLng }
                : null,
            }
          : null,
        witness: contract.witnessSignature
          ? {
              name: contract.witnessName,
              document: contract.witnessDocument,
              signedAt: contract.witnessSignedAt?.toISOString(),
              geolocation: contract.witnessGeoLat
                ? { lat: contract.witnessGeoLat, lng: contract.witnessGeoLng }
                : null,
            }
          : null,
      },
      verification: {
        url: this.generateVerificationUrl(contract.contractToken!),
        generatedAt: new Date().toISOString(),
        platform: 'MR3X Gestão de Aluguéis',
      },
    };

    return { certificate, qrCode, barcode };
  }

  private getVerificationMessage(status: string, hasSignatures: boolean): string {
    if (status === 'ASSINADO' && hasSignatures) {
      return '✓ Contrato válido e assinado por todas as partes';
    }
    if (status === 'ATIVO' && hasSignatures) {
      return '✓ Contrato ativo e em vigência';
    }
    if (status === 'AGUARDANDO_ASSINATURAS') {
      return '⏳ Contrato aguardando assinaturas';
    }
    if (status === 'PENDENTE') {
      return '⏳ Contrato pendente de finalização';
    }
    if (status === 'REVOGADO') {
      return '✗ Contrato foi revogado';
    }
    if (status === 'ENCERRADO') {
      return '✓ Contrato encerrado (finalizado)';
    }
    return `Status: ${status}`;
  }
}
