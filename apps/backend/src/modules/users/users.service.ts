import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  phone: true,
  isActive: true,
  bankName: true,
  bankAccountNo: true,
  bankAccountName: true,
  commissionRate: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      enrollments: true,
      taughtClasses: true,
    },
  },
};

@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) {}

  async findAll() {
    return this.prismaService.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStudents() {
    return this.prismaService.user.findMany({
      where: { role: 'STUDENT', isActive: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prismaService.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email đã được sử dụng');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prismaService.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        phone: dto.phone ?? null,
        isActive: dto.isActive ?? true,
        bankName: dto.bankName ?? null,
        bankAccountNo: dto.bankAccountNo ?? null,
        bankAccountName: dto.bankAccountName ?? null,
        commissionRate: dto.commissionRate ? Number(dto.commissionRate) : null,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, adminId: string) {
    const existing = await this.prismaService.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài khoản');
    if (id === adminId && dto.role && dto.role !== existing.role) {
      throw new ForbiddenException('Không thể tự đổi vai trò của chính mình');
    }
    if (dto.email) {
      const emailTaken = await this.prismaService.user.findFirst({ where: { email: dto.email, id: { not: id } }, select: { id: true } });
      if (emailTaken) throw new ConflictException('Email đã được sử dụng');
    }

    const data: Record<string, unknown> = {};
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.bankName !== undefined) data.bankName = dto.bankName;
    if (dto.bankAccountNo !== undefined) data.bankAccountNo = dto.bankAccountNo;
    if (dto.bankAccountName !== undefined) data.bankAccountName = dto.bankAccountName;
    if (dto.commissionRate !== undefined) data.commissionRate = dto.commissionRate ? Number(dto.commissionRate) : null;
    if (dto.newPassword) data.passwordHash = await bcrypt.hash(dto.newPassword, 10);

    if (Object.keys(data).length === 0) throw new BadRequestException('Không có dữ liệu để cập nhật');

    return this.prismaService.user.update({ where: { id }, data, select: USER_SELECT });
  }

  async remove(id: string, adminId: string) {
    if (id === adminId) throw new ForbiddenException('Không thể xóa tài khoản của chính mình');
    const existing = await this.prismaService.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài khoản');
    await this.prismaService.user.delete({ where: { id } });
    return { message: 'Xóa tài khoản thành công' };
  }

  async getMyProfile(userId: string) {
    return this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        taughtClasses: {
          select: {
            id: true,
            name: true,
            center: { select: { name: true } },
            startDate: true,
            endDate: true,
            _count: { select: { enrollments: true } },
          },
          where: { isActive: true },
        },
        enrollments: {
          select: {
            id: true,
            enrolledAt: true,
            status: true,
            class: {
              select: {
                id: true,
                name: true,
                center: { select: { name: true } },
                teacher: { select: { fullName: true } },
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
    });
  }
}
