import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@config/prisma.service';

@Injectable()
export class ContractHashService {
  constructor(private readonly prisma: PrismaService) {}

  generateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async storeProvisionalHash(contractId: bigint, hash: string): Promise<void> {
    await this.prisma.contract.update({
      where: { id: contractId },
      data: { provisionalHash: hash },
    });
  }

  async storeFinalHash(contractId: bigint, hash: string): Promise<void> {
    await this.prisma.contract.update({
      where: { id: contractId },
      data: { hashFinal: hash },
    });
  }

  async verifyHash(contractId: bigint, providedHash: string): Promise<boolean> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { hashFinal: true },
    });

    if (!contract?.hashFinal) {
      return false;
    }

    return contract.hashFinal === providedHash;
  }

  async verifyHashByToken(token: string, providedHash: string): Promise<{ valid: boolean; message: string }> {
    const contract = await this.prisma.contract.findUnique({
      where: { contractToken: token },
      select: { hashFinal: true, status: true },
    });

    if (!contract) {
      return { valid: false, message: 'Contrato não encontrado' };
    }

    if (!contract.hashFinal) {
      return { valid: false, message: 'Contrato ainda não foi finalizado' };
    }

    const isValid = contract.hashFinal === providedHash;

    return {
      valid: isValid,
      message: isValid
        ? 'Hash válido - documento autêntico'
        : 'Hash inválido - documento pode ter sido alterado',
    };
  }

  async validateUploadedPdf(
    contractToken: string,
    fileBuffer: Buffer,
  ): Promise<{ valid: boolean; computedHash: string; storedHash: string | null; message: string }> {
    const contract = await this.prisma.contract.findUnique({
      where: { contractToken },
      select: { hashFinal: true },
    });

    const computedHash = this.generateHash(fileBuffer);

    if (!contract) {
      return {
        valid: false,
        computedHash,
        storedHash: null,
        message: 'Contrato não encontrado',
      };
    }

    if (!contract.hashFinal) {
      return {
        valid: false,
        computedHash,
        storedHash: null,
        message: 'Contrato ainda não possui hash final',
      };
    }

    const isValid = contract.hashFinal === computedHash;

    return {
      valid: isValid,
      computedHash,
      storedHash: contract.hashFinal,
      message: isValid
        ? 'Documento autêntico - hash corresponde ao original'
        : 'ALERTA: Documento foi modificado - hash não corresponde',
    };
  }
}
