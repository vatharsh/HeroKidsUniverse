import { PartialType } from '@nestjs/swagger';

import { CreateUniverseDto } from './create-universe.dto';

export class UpdateUniverseDto extends PartialType(CreateUniverseDto) {}
