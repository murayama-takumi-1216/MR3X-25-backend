import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Properties')
@Controller('properties')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'List all properties' })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'agencyId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.propertiesService.findAll({ skip, take, agencyId, status, ownerId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property by ID' })
  async findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new property' })
  async create(@Body() data: any, @CurrentUser('sub') userId: string) {
    return this.propertiesService.create(data, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update property' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.propertiesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete property' })
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.propertiesService.remove(id, userId);
  }
}
