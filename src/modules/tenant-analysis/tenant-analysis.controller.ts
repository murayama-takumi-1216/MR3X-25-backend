import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantAnalysisService } from './tenant-analysis.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Tenant Analysis')
@Controller('tenant-analysis')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantAnalysisController {
  constructor(private readonly tenantAnalysisService: TenantAnalysisService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check Cellere API health' })
  async healthCheck() {
    return this.tenantAnalysisService.healthCheck();
  }

  @Post('financial')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get financial analysis for a document' })
  async analyzeFinancial(@Body('document') document: string) {
    return this.tenantAnalysisService.analyzeFinancial(document);
  }

  @Post('background')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get background check for a document' })
  async analyzeBackground(@Body('document') document: string) {
    return this.tenantAnalysisService.analyzeBackground(document);
  }

  @Post('full')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get full tenant analysis (financial + background + risk score)' })
  async getFullAnalysis(@Body('document') document: string) {
    return this.tenantAnalysisService.getFullAnalysis(document);
  }
}
