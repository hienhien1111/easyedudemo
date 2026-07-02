import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

// Snapshot các field cần trả về cho client
const CLASS_SELECT = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  startDate: true,
  endDate: true,
  pricePerSession: true,
  createdAt: true,
  updatedAt: true,
  center: {
    select: { id: true, name: true, address: true },
  },
  teacher: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
  _count: {
    select: {
      enrollments: true,
      sessions: true,
    },
  },
};

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List all classes ──────────────────────────────────────────────────────

  async findAll() {
    return this.prisma.class.findMany({
      select: CLASS_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Find one class ────────────────────────────────────────────────────────

  async findOne(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      select: CLASS_SELECT,
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp học');
    return cls;
  }

  // ─── Create class ──────────────────────────────────────────────────────────

  async create(dto: CreateClassDto) {
    // Kiểm tra center tồn tại
    const center = await this.prisma.center.findUnique({
      where: { id: dto.centerId },
      select: { id: true },
    });
    if (!center) throw new NotFoundException('Không tìm thấy trung tâm');

    // Kiểm tra teacher tồn tại và đúng role
    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherId },
      select: { id: true, role: true, isActive: true },
    });
    if (!teacher) throw new NotFoundException('Không tìm thấy giáo viên');
    if (teacher.role !== 'TEACHER') {
      throw new BadRequestException('Người được chọn không phải giáo viên');
    }
    if (!teacher.isActive) {
      throw new BadRequestException('Giáo viên đã bị vô hiệu hoá');
    }

    // Validate ngày
    if (dto.startDate && dto.endDate && dto.startDate >= dto.endDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    return this.prisma.class.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        centerId: dto.centerId,
        teacherId: dto.teacherId,
        isActive: dto.isActive ?? true,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        pricePerSession: dto.pricePerSession ? Number(dto.pricePerSession) : 0,
      },
      select: CLASS_SELECT,
    });
  }

  // ─── Update class ──────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateClassDto) {
    const existing = await this.prisma.class.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy lớp học');

    // Kiểm tra teacher nếu có thay đổi
    if (dto.teacherId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: dto.teacherId },
        select: { id: true, role: true, isActive: true },
      });
      if (!teacher) throw new NotFoundException('Không tìm thấy giáo viên');
      if (teacher.role !== 'TEACHER') {
        throw new BadRequestException('Người được chọn không phải giáo viên');
      }
      if (!teacher.isActive) {
        throw new BadRequestException('Giáo viên đã bị vô hiệu hoá');
      }
    }

    // Kiểm tra center nếu có thay đổi
    if (dto.centerId) {
      const center = await this.prisma.center.findUnique({
        where: { id: dto.centerId },
        select: { id: true },
      });
      if (!center) throw new NotFoundException('Không tìm thấy trung tâm');
    }

    // Validate ngày
    if (dto.startDate && dto.endDate && dto.startDate >= dto.endDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.centerId !== undefined) data.centerId = dto.centerId;
    if (dto.teacherId !== undefined) data.teacherId = dto.teacherId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.pricePerSession !== undefined) {
      data.pricePerSession = dto.pricePerSession ? Number(dto.pricePerSession) : 0;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Không có dữ liệu để cập nhật');
    }

    return this.prisma.class.update({
      where: { id },
      data,
      select: CLASS_SELECT,
    });
  }

  // ─── Delete class ──────────────────────────────────────────────────────────

  async remove(id: string) {
    const existing = await this.prisma.class.findUnique({
      where: { id },
      select: { id: true, _count: { select: { enrollments: true } } },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy lớp học');

    // Cảnh báo nếu lớp đang có học sinh
    if (existing._count.enrollments > 0) {
      throw new ConflictException(
        `Không thể xóa lớp học đang có ${existing._count.enrollments} học sinh đang đăng ký. Hãy vô hiệu hoá lớp thay vì xóa.`,
      );
    }

    await this.prisma.class.delete({ where: { id } });
    return { message: 'Xóa lớp học thành công' };
  }

  // ─── List teachers for assignment dropdown ─────────────────────────────────

  async getTeachers() {
    return this.prisma.user.findMany({
      where: { role: 'TEACHER', isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        _count: { select: { taughtClasses: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  // ─── List centers for assignment dropdown ──────────────────────────────────

  async getCenters() {
    return this.prisma.center.findMany({
      where: { isActive: true },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    });
  }
}
