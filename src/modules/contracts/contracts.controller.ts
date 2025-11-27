import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'List all contracts' })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: any,
  ) {
    // ADMIN sees only contracts for properties they created (each admin is independent)
    // CEO sees all contracts
    let createdById: string | undefined;
    if (user?.role === 'ADMIN') {
      createdById = user.sub;
    }
    return this.contractsService.findAll({ skip, take, agencyId, status, createdById });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by ID' })
  async findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contract' })
  async create(@Body() data: any, @CurrentUser('sub') userId: string) {
    return this.contractsService.create(data, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update contract' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.contractsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete contract' })
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.contractsService.remove(id, userId);
  }
}
