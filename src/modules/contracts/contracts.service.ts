import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { skip?: number; take?: number; agencyId?: string; status?: string }) {
    const { skip = 0, take = 20, agencyId, status } = params;

    const where: any = { deleted: false };
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (status) where.status = status;

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take,
        include: {
          property: { select: { id: true, address: true, city: true } },
          tenantUser: { select: { id: true, name: true, email: true } },
          ownerUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return {
      data: contracts.map(c => this.serializeContract(c)),
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
        agency: true,
        payments: { orderBy: { dataPagamento: 'desc' }, take: 10 },
      },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    return this.serializeContract(contract);
  }

  async create(data: any, userId: string) {
    const contract = await this.prisma.contract.create({
      data: {
        propertyId: BigInt(data.propertyId),
        tenantId: BigInt(data.tenantId),
        ownerId: data.ownerId ? BigInt(data.ownerId) : null,
        agencyId: data.agencyId ? BigInt(data.agencyId) : null,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        monthlyRent: data.monthlyRent,
        deposit: data.deposit,
        dueDay: data.dueDay,
        description: data.description,
        status: data.status || 'PENDENTE',
      },
    });

    return this.serializeContract(contract);
  }

  async update(id: string, data: any) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract || contract.deleted) {
      throw new NotFoundException('Contract not found');
    }

    const updated = await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data,
    });

    return this.serializeContract(updated);
  }

  async remove(id: string, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(id) },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    await this.prisma.contract.update({
      where: { id: BigInt(id) },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: BigInt(userId),
      },
    });

    return { message: 'Contract deleted successfully' };
  }

  private serializeContract(contract: any) {
    return {
      ...contract,
      id: contract.id.toString(),
      propertyId: contract.propertyId.toString(),
      tenantId: contract.tenantId.toString(),
      ownerId: contract.ownerId?.toString(),
      agencyId: contract.agencyId?.toString(),
      deletedBy: contract.deletedBy?.toString(),
      monthlyRent: contract.monthlyRent?.toString(),
      deposit: contract.deposit?.toString(),
    };
  }
}
