import { Controller, Get, Post, Body, UseGuards, Query, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { TenantAnalysisService } from './tenant-analysis.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OwnerPermissionGuard } from '../../common/guards/owner-permission.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnerPermission } from '../../common/decorators/owner-permission.decorator';
import { OwnerAction } from '../../common/constants/owner-permissions.constants';
import { UserRole } from '@prisma/client';
import { AnalyzeTenantDto, GetAnalysisHistoryDto } from './dto';

@ApiTags('Tenant Analysis')
@Controller('tenant-analysis')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerPermissionGuard)
@ApiBearerAuth()
export class TenantAnalysisController {
  constructor(private readonly tenantAnalysisService: TenantAnalysisService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check tenant analysis service health' })
  async healthCheck() {
    return this.tenantAnalysisService.healthCheck();
  }

  @Post('analyze')
  @Roles(
    UserRole.CEO,
    UserRole.ADMIN,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_MANAGER,
    UserRole.BROKER,
    UserRole.INDEPENDENT_OWNER,
    UserRole.PROPRIETARIO
  )
  @OwnerPermission('tenant_analysis', OwnerAction.CREATE)
  @ApiOperation({ summary: 'Perform a complete tenant analysis' })
  async analyzeTenant(
    @Body() dto: AnalyzeTenantDto,
    @CurrentUser() user: any,
  ) {
    try {
      const userId = BigInt(user.sub);
      const agencyId = user.agencyId ? BigInt(user.agencyId) : undefined;
      return await this.tenantAnalysisService.analyzeTenant(dto, userId, agencyId);
    } catch (error) {
      // Return user-friendly error response
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: error.message || 'Erro ao realizar análise do inquilino',
          error: 'Analysis Failed',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('history')
  @Roles(
    UserRole.CEO,
    UserRole.ADMIN,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_MANAGER,
    UserRole.BROKER,
    UserRole.INDEPENDENT_OWNER,
    UserRole.PROPRIETARIO
  )
  @ApiOperation({ summary: 'Get analysis history with filters' })
  @ApiQuery({ name: 'document', required: false, description: 'Filter by document' })
  @ApiQuery({ name: 'riskLevel', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAnalysisHistory(
    @Query() dto: GetAnalysisHistoryDto,
    @CurrentUser() user: any,
  ) {
    const userId = BigInt(user.sub);
    const agencyId = user.agencyId ? BigInt(user.agencyId) : undefined;
    return this.tenantAnalysisService.getAnalysisHistory(dto, userId, user.role, agencyId);
  }

  @Get('stats')
  @Roles(
    UserRole.CEO,
    UserRole.ADMIN,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_MANAGER,
    UserRole.BROKER,
    UserRole.INDEPENDENT_OWNER,
    UserRole.PROPRIETARIO
  )
  @ApiOperation({ summary: 'Get analysis statistics for dashboard' })
  async getAnalysisStats(@CurrentUser() user: any) {
    const userId = BigInt(user.sub);
    const agencyId = user.agencyId ? BigInt(user.agencyId) : undefined;
    return this.tenantAnalysisService.getAnalysisStats(userId, user.role, agencyId);
  }

  @Get(':id')
  @Roles(
    UserRole.CEO,
    UserRole.ADMIN,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_MANAGER,
    UserRole.BROKER,
    UserRole.INDEPENDENT_OWNER,
    UserRole.PROPRIETARIO
  )
  @ApiOperation({ summary: 'Get a specific analysis by ID' })
  @ApiParam({ name: 'id', description: 'Analysis ID' })
  async getAnalysisById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = BigInt(user.sub);
    const agencyId = user.agencyId ? BigInt(user.agencyId) : undefined;
    return this.tenantAnalysisService.getAnalysisById(BigInt(id), userId, user.role, agencyId);
  }

  // Legacy endpoints for backward compatibility
  @Post('financial')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get financial analysis for a document (legacy)' })
  async analyzeFinancial(@Body('document') document: string) {
    return this.tenantAnalysisService.analyzeFinancial(document);
  }

  @Post('background')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get background check for a document (legacy)' })
  async analyzeBackground(@Body('document') document: string) {
    return this.tenantAnalysisService.analyzeBackground(document);
  }

  @Post('full')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get full tenant analysis (legacy)' })
  async getFullAnalysis(@Body('document') document: string) {
    return this.tenantAnalysisService.getFullAnalysis(document);
  }
}
