import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { GetOrCreateSessionDto } from './dto/get-or-create-session.dto';

// ─── Mapping ngày JS (0=Sun) → DayOfWeek enum ────────────────────────────────
const JS_DAY_TO_ENUM = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ─── Select snapshot ──────────────────────────────────────────────────────────

const SESSION_SELECT = {
  id: true,
  classId: true,
  templateId: true,
  date: true,
  startTime: true,
  endTime: true,
  room: true,
  notes: true,
  status: true,
  createdAt: true,
  class: {
    select: {
      id: true,
      name: true,
      teacher: { select: { id: true, fullName: true } },
      center: { select: { id: true, name: true } },
    },
  },
  attendanceRecords: {
    select: {
      id: true,
      studentId: true,
      status: true,
      notes: true,
      markedAt: true,
      marker: { select: { id: true, fullName: true } },
      student: { select: { id: true, fullName: true, email: true, phone: true } },
    },
  },
};

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Get today's sessions for the current user ───────────────────────────────
  // Generates the list of sessions that SHOULD happen today based on templates.
  // Returns templates matching today's day-of-week + filters by role.

  async getTodaySessions(user: any) {
    const today = new Date();
    const todayDow = JS_DAY_TO_ENUM[today.getDay()]; // e.g. "WED"
    const todayDateStr = today.toISOString().split('T')[0]; // "2026-07-02"

    // Build class filter based on role
    let classFilter: any = {};
    if (user.role === 'TEACHER') {
      classFilter = { class: { teacherId: user.id } };
    }
    // ADMIN sees all

    // Get active templates for today's day of week
    const templates = await this.prisma.weeklyScheduleTemplate.findMany({
      where: {
        isActive: true,
        dayOfWeek: todayDow as any,
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        ...classFilter,
      },
      select: {
        id: true,
        classId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        room: true,
        class: {
          select: {
            id: true,
            name: true,
            isActive: true,
            teacher: { select: { id: true, fullName: true } },
            center: { select: { id: true, name: true } },
            _count: { select: { enrollments: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // For each template, check if a ClassSession already exists for today
    const sessionsWithStatus = await Promise.all(
      templates.map(async (tmpl) => {
        const existingSession = await this.prisma.classSession.findFirst({
          where: {
            classId: tmpl.classId,
            templateId: tmpl.id,
            date: new Date(todayDateStr),
          },
          select: {
            id: true,
            status: true,
            _count: { select: { attendanceRecords: true } },
          },
        });

        // Compute "window status" based on current time
        const now = today;
        const [startH, startM] = tmpl.startTime.split(':').map(Number);
        const [endH, endM] = tmpl.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        let timeStatus: 'upcoming' | 'active' | 'ended';
        if (nowMinutes < startMinutes - 15) timeStatus = 'upcoming';
        else if (nowMinutes > endMinutes) timeStatus = 'ended';
        else timeStatus = 'active';

        return {
          template: tmpl,
          session: existingSession ?? null,
          timeStatus,
          date: todayDateStr,
        };
      }),
    );

    return sessionsWithStatus;
  }

  // ─── Get or create a ClassSession for a given template + date ───────────────
  // Called when teacher clicks "Điểm danh" — ensures session record exists.

  async getOrCreateSession(dto: GetOrCreateSessionDto, user: any) {
    // Verify teacher owns the class (or is admin)
    const cls = await this.prisma.class.findUnique({
      where: { id: dto.classId },
      select: { id: true, teacherId: true },
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp học');
    if (user.role === 'TEACHER' && cls.teacherId !== user.id) {
      throw new ForbiddenException('Bạn không phải giáo viên của lớp này');
    }

    const dateObj = new Date(dto.date);

    // Upsert session
    const session = await this.prisma.classSession.upsert({
      where: {
        classId_date_startTime: {
          classId: dto.classId,
          date: dateObj,
          startTime: dto.startTime,
        },
      },
      create: {
        classId: dto.classId,
        templateId: dto.templateId,
        date: dateObj,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room ?? null,
        status: 'IN_PROGRESS',
      },
      update: {}, // keep existing if already created
      select: SESSION_SELECT,
    });

    return session;
  }

  // ─── Get full session detail with attendance records ────────────────────────

  async getSession(sessionId: string, user: any) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: SESSION_SELECT,
    });
    if (!session) throw new NotFoundException('Không tìm thấy buổi học');

    // Permission check
    const cls = await this.prisma.class.findUnique({
      where: { id: session.classId },
      select: { teacherId: true },
    });
    if (user.role === 'TEACHER' && cls?.teacherId !== user.id) {
      throw new ForbiddenException('Bạn không có quyền xem buổi học này');
    }

    // Also get enrolled students not yet marked
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId: session.classId, status: 'ACTIVE' },
      select: {
        student: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    const markedIds = new Set(session.attendanceRecords.map((r) => r.studentId));
    const unmarked = enrollments
      .filter((e) => !markedIds.has(e.student.id))
      .map((e) => e.student);

    return { session, unmarkedStudents: unmarked };
  }

  // ─── Mark attendance for a student ──────────────────────────────────────────

  async markAttendance(sessionId: string, dto: MarkAttendanceDto, user: any) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true },
    });
    if (!session) throw new NotFoundException('Không tìm thấy buổi học');

    // Permission check
    const cls = await this.prisma.class.findUnique({
      where: { id: session.classId },
      select: { teacherId: true },
    });
    if (user.role === 'TEACHER' && cls?.teacherId !== user.id) {
      throw new ForbiddenException('Bạn không có quyền điểm danh lớp này');
    }

    // Verify student is enrolled
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: dto.studentId, classId: session.classId } },
    });
    if (!enrollment) {
      throw new NotFoundException('Học viên không thuộc lớp này');
    }

    // Upsert attendance record
    const record = await this.prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: { sessionId, studentId: dto.studentId },
      },
      create: {
        sessionId,
        studentId: dto.studentId,
        status: dto.status,
        markedBy: user.id,
        notes: dto.notes ?? null,
      },
      update: {
        status: dto.status,
        markedBy: user.id,
        notes: dto.notes ?? null,
        markedAt: new Date(),
      },
      select: {
        id: true,
        sessionId: true,
        studentId: true,
        status: true,
        notes: true,
        markedAt: true,
        student: { select: { id: true, fullName: true, email: true } },
        marker: { select: { id: true, fullName: true } },
      },
    });

    return record;
  }

  // ─── Bulk mark attendance (mark all remaining as a status) ──────────────────

  async bulkMarkAttendance(
    sessionId: string,
    records: { studentId: string; status: string }[],
    user: any,
  ) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true },
    });
    if (!session) throw new NotFoundException('Không tìm thấy buổi học');

    const cls = await this.prisma.class.findUnique({
      where: { id: session.classId },
      select: { teacherId: true },
    });
    if (user.role === 'TEACHER' && cls?.teacherId !== user.id) {
      throw new ForbiddenException('Bạn không có quyền điểm danh lớp này');
    }

    // Upsert all at once
    await Promise.all(
      records.map((r) =>
        this.prisma.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId, studentId: r.studentId } },
          create: {
            sessionId,
            studentId: r.studentId,
            status: r.status as any,
            markedBy: user.id,
          },
          update: {
            status: r.status as any,
            markedBy: user.id,
            markedAt: new Date(),
          },
        }),
      ),
    );

    // Return fresh session
    return this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: SESSION_SELECT,
    });
  }

  // ─── Complete session ────────────────────────────────────────────────────────

  async completeSession(sessionId: string, user: any) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true },
    });
    if (!session) throw new NotFoundException('Không tìm thấy buổi học');

    const cls = await this.prisma.class.findUnique({
      where: { id: session.classId },
      select: { teacherId: true },
    });
    if (user.role === 'TEACHER' && cls?.teacherId !== user.id) {
      throw new ForbiddenException('Không có quyền');
    }

    return this.prisma.classSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' },
      select: { id: true, status: true },
    });
  }

  // ─── Get sessions history for a class ───────────────────────────────────────

  async getSessionsHistory(classId: string, user: any) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, teacherId: true },
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp học');
    if (user.role === 'TEACHER' && cls.teacherId !== user.id) {
      throw new ForbiddenException('Không có quyền xem lớp này');
    }

    return this.prisma.classSession.findMany({
      where: { classId },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        _count: { select: { attendanceRecords: true } },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }
}
