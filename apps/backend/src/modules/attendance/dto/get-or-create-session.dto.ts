import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GetOrCreateSessionDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  templateId: string;

  /** ISO date string YYYY-MM-DD */
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsString()
  room?: string;
}
