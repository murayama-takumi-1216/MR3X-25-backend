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
    const serialized: any = {
      ...contract,
      id: contract.id.toString(),
      propertyId: contract.propertyId.toString(),
      tenantId: contract.tenantId.toString(),
      ownerId: contract.ownerId?.toString() || null,
      agencyId: contract.agencyId?.toString() || null,
      deletedBy: contract.deletedBy?.toString() || null,
      monthlyRent: contract.monthlyRent?.toString() || null,
      deposit: contract.deposit?.toString() || null,
      createdAt: contract.createdAt?.toISOString() || null,
      updatedAt: contract.updatedAt?.toISOString() || null,
      startDate: contract.startDate?.toISOString() || null,
      endDate: contract.endDate?.toISOString() || null,
      deletedAt: contract.deletedAt?.toISOString() || null,
    };

    // Serialize nested property object
    if (contract.property) {
      serialized.property = {
        ...contract.property,
        id: contract.property.id?.toString() || null,
        ownerId: contract.property.ownerId?.toString() || null,
        agencyId: contract.property.agencyId?.toString() || null,
        brokerId: contract.property.brokerId?.toString() || null,
        createdBy: contract.property.createdBy?.toString() || null,
      };
    }

    // Serialize nested tenantUser object
    if (contract.tenantUser) {
      serialized.tenantUser = {
        ...contract.tenantUser,
        id: contract.tenantUser.id?.toString() || null,
        agencyId: contract.tenantUser.agencyId?.toString() || null,
        companyId: contract.tenantUser.companyId?.toString() || null,
        brokerId: contract.tenantUser.brokerId?.toString() || null,
        createdBy: contract.tenantUser.createdBy?.toString() || null,
        ownerId: contract.tenantUser.ownerId?.toString() || null,
      };
    }

    // Serialize nested ownerUser object
    if (contract.ownerUser) {
      serialized.ownerUser = {
        ...contract.ownerUser,
        id: contract.ownerUser.id?.toString() || null,
        agencyId: contract.ownerUser.agencyId?.toString() || null,
        companyId: contract.ownerUser.companyId?.toString() || null,
        brokerId: contract.ownerUser.brokerId?.toString() || null,
        createdBy: contract.ownerUser.createdBy?.toString() || null,
        ownerId: contract.ownerUser.ownerId?.toString() || null,
      };
    }

    // Serialize nested agency object
    if (contract.agency) {
      serialized.agency = {
        ...contract.agency,
        id: contract.agency.id?.toString() || null,
        companyId: contract.agency.companyId?.toString() || null,
        createdBy: contract.agency.createdBy?.toString() || null,
      };
    }

    // Serialize nested payments array
    if (contract.payments && Array.isArray(contract.payments)) {
      serialized.payments = contract.payments.map((payment: any) => ({
        ...payment,
        id: payment.id?.toString() || null,
        contratoId: payment.contratoId?.toString() || null,
        createdBy: payment.createdBy?.toString() || null,
        dataPagamento: payment.dataPagamento?.toISOString() || null,
        createdAt: payment.createdAt?.toISOString() || null,
        updatedAt: payment.updatedAt?.toISOString() || null,
      }));
    }

    return serialized;
  }
}
