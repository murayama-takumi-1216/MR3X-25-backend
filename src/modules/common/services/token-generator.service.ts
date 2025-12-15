import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

export enum TokenEntityType {
  CONTRACT = 'CTR',
  PROPERTY = 'IMO',
  TENANT = 'INQ',
  OWNER = 'PRO',
  BROKER = 'COR',
  MANAGER = 'GER',
  DOCUMENT = 'DOC',
  INVOICE = 'INV',
  AGENCY = 'AGE',
}

@Injectable()
export class TokenGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generateToken(entityType: TokenEntityType): Promise<string> {
    const maxAttempts = 10;
    let attempt = 0;

    while (attempt < maxAttempts) {
      const token = this.createToken(entityType);

      const exists = await this.tokenExists(token, entityType);

      if (!exists) {
        return token;
      }

      attempt++;
    }

    throw new Error(
      `Failed to generate unique token for ${entityType} after ${maxAttempts} attempts`,
    );
  }

  private createToken(entityType: TokenEntityType): string {
    const year = new Date().getFullYear();
    const segment1 = this.generateRandomSegment();
    const segment2 = this.generateRandomSegment();

    return `MR3X-${entityType}-${year}-${segment1}-${segment2}`;
  }

  private generateRandomSegment(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let segment = '';

    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return segment;
  }

  private async tokenExists(
    token: string,
    entityType: TokenEntityType,
  ): Promise<boolean> {
    try {
      switch (entityType) {
        case TokenEntityType.CONTRACT:
          const contract = await this.prisma.contract.findFirst({
            where: { contractToken: token },
          });
          return !!contract;

        case TokenEntityType.PROPERTY:
          const property = await this.prisma.property.findFirst({
            where: { token },
          });
          return !!property;

        case TokenEntityType.TENANT:
        case TokenEntityType.OWNER:
        case TokenEntityType.BROKER:
        case TokenEntityType.MANAGER:
          const user = await this.prisma.user.findFirst({
            where: { token },
          });
          return !!user;

        case TokenEntityType.DOCUMENT:
          const document = await this.prisma.document.findFirst({
            where: { token },
          });
          return !!document;

        case TokenEntityType.INVOICE:
          const invoice = await this.prisma.invoice.findFirst({
            where: { token },
          });
          return !!invoice;

        case TokenEntityType.AGENCY:
          const agency = await this.prisma.agency.findFirst({
            where: { token },
          });
          return !!agency;

        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  parseToken(token: string): {
    prefix: string;
    entityType: string;
    year: number;
    segment1: string;
    segment2: string;
  } | null {
    const parts = token.split('-');

    if (parts.length !== 5 || parts[0] !== 'MR3X') {
      return null;
    }

    return {
      prefix: parts[0],
      entityType: parts[1],
      year: parseInt(parts[2], 10),
      segment1: parts[3],
      segment2: parts[4],
    };
  }

  isValidTokenFormat(token: string): boolean {
    const pattern = /^MR3X-[A-Z]{3}-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return pattern.test(token);
  }

  getEntityTypeFromToken(token: string): TokenEntityType | null {
    const parsed = this.parseToken(token);
    if (!parsed) {
      return null;
    }

    const typeMap: { [key: string]: TokenEntityType } = {
      CTR: TokenEntityType.CONTRACT,
      IMO: TokenEntityType.PROPERTY,
      INQ: TokenEntityType.TENANT,
      LOC: TokenEntityType.TENANT,
      PRO: TokenEntityType.OWNER,
      COR: TokenEntityType.BROKER,
      GER: TokenEntityType.MANAGER,
      DOC: TokenEntityType.DOCUMENT,
      INV: TokenEntityType.INVOICE,
      AGE: TokenEntityType.AGENCY,
    };

    return typeMap[parsed.entityType] || null;
  }
}
