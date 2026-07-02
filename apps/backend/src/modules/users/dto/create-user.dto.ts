import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  MinLength,
  Matches,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email là bắt buộc' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu là bắt buộc' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ tên là bắt buộc' })
  fullName: string;

  @IsEnum(Role, { message: 'Vai trò không hợp lệ' })
  @IsNotEmpty({ message: 'Vai trò là bắt buộc' })
  role: Role;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // ─── Teacher-specific fields ─────────────────────────────────────────────

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  bankAccountNo?: string;

  @IsString()
  @IsOptional()
  bankAccountName?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'Commission rate không hợp lệ (VD: 0.3000)' })
  commissionRate?: string;
}
