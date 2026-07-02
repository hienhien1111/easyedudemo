import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleDto } from './create-schedule.dto';
import { OmitType } from '@nestjs/mapped-types';

export class UpdateScheduleDto extends PartialType(
  OmitType(CreateScheduleDto, ['classId'] as const),
) {}
