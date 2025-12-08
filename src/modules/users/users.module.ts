import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PlansModule } from '../plans/plans.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PlansModule, CommonModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
