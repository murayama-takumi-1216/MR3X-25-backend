import { Module } from '@nestjs/common';
import { TenantAnalysisController } from './tenant-analysis.controller';
import { TenantAnalysisService } from './tenant-analysis.service';
import { CellereService } from './integrations/cellere.service';

@Module({
  controllers: [TenantAnalysisController],
  providers: [TenantAnalysisService, CellereService],
  exports: [TenantAnalysisService, CellereService],
})
export class TenantAnalysisModule {}
