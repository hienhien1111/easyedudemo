import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateScheduleDto, ALLOWED_TIME_SLOTS } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

// ─── Select snapshot ──────────────────────────────────────────────────────────

const TEMPLATE_SELECT = {
  id: true,
  classId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
  isActive: true,
  effectiveFrom: true,
  effectiveTo: true,
  createdAt: true,
  updatedAt: true,
  class: {
    select: {
      id: true,
      name: true,
      isActive: true,
      teacher: { select: { id: true, fullName: true, email: true } },
      center: { select: { id: true, name: true } },
    },
  },
};

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Validate time slot ──────────────────────────────────────────────────────

  private validateTimeSlot(startTime: string, endTime: string) {
    const valid = ALLOWED_TIME_SLOTS.some(
      (slot) => slot.start === startTime && slot.end === endTime,
    );
    if (!valid) {
      throw new BadRequestException(
        'Khung giờ không hợp lệ. Chỉ chấp nhận: 7-9h, 9-11h, 13-15h, 15-17h, 19-21h',
      );
    }
  }

  // ─── Check class access ──────────────────────────────────────────────────────

  private async checkClassAccess(classId: string, user: any) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, teacherId: true },
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp học');
    if (user.role === 'TEACHER' && cls.teacherId !== user.id) {
      throw new ForbiddenException('Bạn không có quyền truy cập lớp học này');
    }
    return cls;
  }

  // ─── Get schedule — for the weekly grid view ─────────────────────────────────
  // Returns all active templates grouped by class for the caller's permission scope.

  async getSchedule(user: any) {
    let where: any = {};

    if (user.role === 'TEACHER') {
      // Teacher only sees classes they teach
      where = { class: { teacherId: user.id } };
    } else if (user.role === 'STUDENT') {
      // Student sees classes they are enrolled in
      const enrollments = await this.prisma.enrollment.findMany({
        where: { studentId: user.id, status: 'ACTIVE' },
        select: { classId: true },
      });
      where = { classId: { in: enrollments.map((e) => e.classId) } };
    }
    // ADMIN sees all

    return this.prisma.weeklyScheduleTemplate.findMany({
      where: { isActive: true, ...where },
      select: TEMPLATE_SELECT,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ─── Get templates for a specific class ─────────────────────────────────────

  async getByClass(classId: string, user: any) {
    await this.checkClassAccess(classId, user);

    return this.prisma.weeklyScheduleTemplate.findMany({
      where: { classId },
      select: TEMPLATE_SELECT,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ─── Create template ─────────────────────────────────────────────────────────

  async create(dto: CreateScheduleDto, user: any) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Chỉ admin mới có thể tạo lịch học');

    this.validateTimeSlot(dto.startTime, dto.endTime);
    await this.checkClassAccess(dto.classId, user);

    // Check for conflict: same class, same day, same time slot, overlapping effective period
    const conflict = await this.prisma.weeklyScheduleTemplate.findFirst({
      where: {
        classId: dto.classId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        isActive: true,
        // effectiveTo is null (still active) or overlaps
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date(dto.effectiveFrom) } },
        ],
      },
    });
    if (conflict) {
      throw new BadRequestException(
        'Lớp này đã có lịch học vào khung giờ và ngày trong tuần này.',
      );
    }

    return this.prisma.weeklyScheduleTemplate.create({
      data: {
        classId: dto.classId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room ?? null,
        isActive: dto.isActive ?? true,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
      select: TEMPLATE_SELECT,
    });
  }

  // ─── Update template ─────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateScheduleDto, user: any) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Chỉ admin mới có thể sửa lịch học');

    const existing = await this.prisma.weeklyScheduleTemplate.findUnique({
      where: { id },
      select: { id: true, classId: true, dayOfWeek: true, startTime: true, endTime: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy lịch học');

    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    if (dto.startTime || dto.endTime) {
      this.validateTimeSlot(newStartTime, newEndTime);
    }

    const data: Record<string, unknown> = {};
    if (dto.dayOfWeek !== undefined) data.dayOfWeek = dto.dayOfWeek;
    if (dto.startTime !== undefined) data.startTime = dto.startTime;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;
    if (dto.room !== undefined) data.room = dto.room;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.effectiveFrom !== undefined) data.effectiveFrom = new Date(dto.effectiveFrom);
    if (dto.effectiveTo !== undefined) data.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Không có dữ liệu để cập nhật');
    }

    return this.prisma.weeklyScheduleTemplate.update({
      where: { id },
      data,
      select: TEMPLATE_SELECT,
    });
  }

  // ─── Delete template ─────────────────────────────────────────────────────────

  async remove(id: string, user: any) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Chỉ admin mới có thể xóa lịch học');

    const existing = await this.prisma.weeklyScheduleTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy lịch học');

    await this.prisma.weeklyScheduleTemplate.delete({ where: { id } });
    return { message: 'Xóa lịch học thành công' };
  }
}
