import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { GenerationService } from './generation.service';

@Controller('generation-jobs')
export class GenerationJobsController {
  constructor(private readonly generationService: GenerationService) {}

  @Get()
  findAll(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.generationService.getActiveJobs(currentUser.id);
  }
}
