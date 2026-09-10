import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/auth/guards/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getRoot(): { message: string } {
    return this.appService.getRoot();
  }

  @Get('health')
  @Public()
  getHealth(): { status: string; service: string; timestamp: string } {
    return this.appService.getHealth();
  }
}
