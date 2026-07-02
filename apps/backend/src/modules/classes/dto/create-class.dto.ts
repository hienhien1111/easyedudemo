import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  Matches,
} from 'class-validator';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên lớp là bắt buộc' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty({ message: 'ID trung tâm là bắt buộc' })
  centerId: string;

  @IsString()
  @IsNotEmpty({ message: 'ID giáo viên là bắt buộc' })
  teacherId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'Giá học phí không hợp lệ (VD: 150000)' })
  pricePerSession?: string;
}
