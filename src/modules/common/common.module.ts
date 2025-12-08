import { Module } from '@nestjs/common';
import { TokenGeneratorService } from './services/token-generator.service';

@Module({
  providers: [TokenGeneratorService],
  exports: [TokenGeneratorService],
})
export class CommonModule {}
