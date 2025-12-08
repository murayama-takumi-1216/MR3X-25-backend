import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertyImagesPublicController } from './property-images-public.controller';
import { PropertiesService } from './properties.service';
import { PropertyImagesService } from './property-images.service';
import { PlansModule } from '../plans/plans.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PlansModule, CommonModule],
  controllers: [PropertyImagesPublicController, PropertiesController],
  providers: [PropertiesService, PropertyImagesService],
  exports: [PropertiesService, PropertyImagesService],
})
export class PropertiesModule {}
