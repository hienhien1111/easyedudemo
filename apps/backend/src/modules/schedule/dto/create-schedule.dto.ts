import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { DayOfWeek } from '@prisma/client';

// Các khung giờ cố định được phép
export const ALLOWED_TIME_SLOTS = [
  { start: '07:00', end: '09:00' },
  { start: '09:00', end: '11:00' },
  { start: '13:00', end: '15:00' },
  { start: '15:00', end: '17:00' },
  { start: '19:00', end: '21:00' },
] as const;

export type TimeSlot = (typeof ALLOWED_TIME_SLOTS)[number];

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  /**
   * Giờ bắt đầu — chỉ chấp nhận: "07:00" | "09:00" | "13:00" | "15:00" | "19:00"
   */
  @IsString()
  @IsNotEmpty()
  startTime: string;

  /**
   * Giờ kết thúc — chỉ chấp nhận: "09:00" | "11:00" | "15:00" | "17:00" | "21:00"
   */
  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
