import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlansService, PlanUpdateDTO } from './plans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Plans')
@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Get all plans' })
  async getPlans() {
    return this.plansService.getPlans();
  }

  @Get('modification-requests/pending')
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'Get pending plan modification requests (CEO only)' })
  async getPendingModificationRequests() {
    return this.plansService.getPendingModificationRequests();
  }

  @Get('modification-requests')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all plan modification requests' })
  async getAllModificationRequests() {
    return this.plansService.getAllModificationRequests();
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Get plan by ID' })
  async getPlanById(@Param('id') id: string) {
    return this.plansService.getPlanById(id);
  }

  @Put(':id')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update plan (CEO: direct update, ADMIN: creates modification request)' })
  async updatePlan(@Param('id') id: string, @Body() data: PlanUpdateDTO, @Request() req: any) {
    const userId = req.user.sub;
    const userRole = req.user.role as UserRole;
    return this.plansService.updatePlan(id, data, userId, userRole);
  }

  @Put('name/:name')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update plan by name (CEO: direct update, ADMIN: creates modification request)' })
  async updatePlanByName(@Param('name') name: string, @Body() data: PlanUpdateDTO, @Request() req: any) {
    const userId = req.user.sub;
    const userRole = req.user.role as UserRole;
    return this.plansService.updatePlanByName(name, data, userId, userRole);
  }

  @Post('modification-requests/:id/approve')
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'Approve a plan modification request (CEO only)' })
  async approveModificationRequest(@Param('id') id: string, @Request() req: any) {
    const reviewerId = req.user.sub;
    return this.plansService.approveModificationRequest(id, reviewerId);
  }

  @Post('modification-requests/:id/reject')
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'Reject a plan modification request (CEO only)' })
  async rejectModificationRequest(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any
  ) {
    const reviewerId = req.user.sub;
    return this.plansService.rejectModificationRequest(id, reviewerId, body.reason);
  }

  @Post('update-counts')
  @Roles(UserRole.ADMIN, UserRole.CEO)
  @ApiOperation({ summary: 'Update subscriber counts for all plans' })
  async updateSubscriberCounts() {
    return this.plansService.updateSubscriberCounts();
  }
}

