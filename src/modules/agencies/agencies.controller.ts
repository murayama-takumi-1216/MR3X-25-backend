import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AgenciesService, AgencyCreateDTO, AgencyUpdateDTO } from './agencies.service';

@ApiTags('Agencies')
@Controller('agencies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all agencies' })
  async getAgencies() {
    return this.agenciesService.getAgencies();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agency by ID' })
  async getAgencyById(@Param('id') id: string) {
    return this.agenciesService.getAgencyById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new agency' })
  async createAgency(@Body() data: AgencyCreateDTO) {
    return this.agenciesService.createAgency(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an agency' })
  async updateAgency(@Param('id') id: string, @Body() data: AgencyUpdateDTO) {
    return this.agenciesService.updateAgency(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an agency' })
  async deleteAgency(@Param('id') id: string) {
    return this.agenciesService.deleteAgency(id);
  }
}
