import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './guards/public.decorator';
import { Sla } from './shared/observability/metrics/sla';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Sla('ping')
  @Public()
  getRoot(): { message: string } {
    return this.appService.getRoot();
  }
}
