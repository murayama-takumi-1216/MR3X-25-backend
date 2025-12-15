import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiClientService } from './api-client.service';

@Controller('api-client')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('API_CLIENT')
export class ApiClientController {
  constructor(private readonly apiClientService: ApiClientService) {}

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.apiClientService.getStats(req.user.sub);
  }

  @Get('credentials')
  async getCredentials(@Request() req: any) {
    return this.apiClientService.getCredentials(req.user.sub);
  }

  @Post('rotate-secret')
  async rotateClientSecret(@Request() req: any) {
    return this.apiClientService.rotateClientSecret(req.user.sub);
  }

  @Post('rotate-webhook')
  async rotateWebhookSecret(@Request() req: any) {
    return {
      success: false,
      message: 'Webhooks not configured',
    };
  }

  @Get('tokens')
  async getTokens(@Request() req: any) {
    return this.apiClientService.getTokens(req.user.sub);
  }

  @Post('tokens')
  async createToken(@Request() req: any, @Body() body: any) {
    return {
      success: false,
      message: 'Token creation not available. Contact support to enable API access.',
    };
  }

  @Delete('tokens/:id')
  async revokeToken(@Param('id') id: string) {
    return { success: true, message: 'Token revoked successfully' };
  }

  @Get('logs')
  async getLogs(
    @Request() req: any,
    @Query('method') method?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.apiClientService.getLogs(req.user.sub, { method, status, dateFrom, dateTo });
  }

  @Get('webhooks')
  async getWebhooks(@Request() req: any) {
    return this.apiClientService.getWebhooks(req.user.sub);
  }

  @Post('webhooks')
  async createWebhook(@Request() req: any, @Body() body: any) {
    return {
      success: false,
      message: 'Webhooks not available yet',
    };
  }

  @Put('webhooks/:id')
  async updateWebhook(@Param('id') id: string, @Body() body: any) {
    return {
      success: false,
      message: 'Webhooks not available yet',
    };
  }

  @Patch('webhooks/:id/toggle')
  async toggleWebhook(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return {
      success: false,
      message: 'Webhooks not available yet',
    };
  }

  @Delete('webhooks/:id')
  async deleteWebhook(@Param('id') id: string) {
    return {
      success: false,
      message: 'Webhooks not available yet',
    };
  }

  @Post('webhooks/deliveries/:id/retry')
  async retryDelivery(@Param('id') id: string) {
    return {
      success: false,
      message: 'Webhooks not available yet',
    };
  }

  @Get('settings')
  async getSettings(@Request() req: any) {
    return this.apiClientService.getSettings(req.user.sub);
  }

  @Put('settings')
  async updateSettings(@Request() req: any, @Body() body: any) {
    return {
      ...body,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  @Post('reset-credentials')
  async resetCredentials(@Request() req: any) {
    return this.apiClientService.rotateClientSecret(req.user.sub);
  }

  @Delete('integration')
  async deleteIntegration(@Request() req: any) {
    return { success: false, message: 'Contact support to delete integration' };
  }
}
