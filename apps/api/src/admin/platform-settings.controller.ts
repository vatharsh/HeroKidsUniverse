import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { AdminService } from './admin.service';

@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Get()
  getSettings() {
    return this.adminService.getSettings();
  }
}
