import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditorService } from './auditor.service';

@Controller('auditor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('LEGAL_AUDITOR', 'CEO', 'ADMIN', 'PLATFORM_MANAGER', 'AGENCY_ADMIN')
export class AuditorController {
  constructor(private readonly auditorService: AuditorService) {}

  @Get('dashboard/metrics')
  async getDashboardMetrics() {
    return this.auditorService.getDashboardMetrics();
  }

  @Get('dashboard/agency-plan-distribution')
  async getAgencyPlanDistribution() {
    return this.auditorService.getAgencyPlanDistribution();
  }

  @Get('dashboard/contract-status-distribution')
  async getContractStatusDistribution() {
    return this.auditorService.getContractStatusDistribution();
  }

  @Get('dashboard/monthly-transactions')
  async getMonthlyTransactions() {
    return this.auditorService.getMonthlyTransactions();
  }

  @Get('dashboard/signature-activity')
  async getSignatureActivity() {
    return this.auditorService.getSignatureActivity();
  }

  @Get('dashboard/user-role-distribution')
  async getUserRoleDistribution() {
    return this.auditorService.getUserRoleDistribution();
  }

  @Get('dashboard/payment-status-distribution')
  async getPaymentStatusDistribution() {
    return this.auditorService.getPaymentStatusDistribution();
  }

  @Get('dashboard/logs-summary')
  async getLogsSummary() {
    return this.auditorService.getLogsSummary();
  }

  @Get('dashboard/revenue-trend')
  async getRevenueTrend() {
    return this.auditorService.getRevenueTrend();
  }

  @Get('dashboard/recent-activity')
  async getRecentActivity() {
    return this.auditorService.getRecentActivity();
  }

  @Get('dashboard/system-status')
  async getSystemStatus() {
    return this.auditorService.getSystemStatus();
  }

  @Get('dashboard/summary-stats')
  async getSummaryStats() {
    return this.auditorService.getSummaryStats();
  }

  @Get('agencies')
  async getAgencies(@Query('search') search?: string) {
    return this.auditorService.getAgencies(search);
  }

  @Get('users')
  async getUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.auditorService.getUsers({ role, status, search });
  }

  @Get('documents')
  async getDocuments(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.auditorService.getDocuments({ type, status, search });
  }

  @Get('logs')
  async getLogs(
    @Query('event') event?: string,
    @Query('entity') entity?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.auditorService.getLogs({ event, entity, dateFrom, dateTo });
  }

  @Get('payments')
  async getPayments(
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.auditorService.getPayments({ status, dateFrom, dateTo });
  }

  @Get('security')
  async getSecurityData() {
    return this.auditorService.getSecurityData();
  }

  @Get('integrity')
  async getIntegrityData() {
    return this.auditorService.getIntegrityData();
  }
}
