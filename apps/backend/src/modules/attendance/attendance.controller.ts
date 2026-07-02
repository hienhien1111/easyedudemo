import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { GetOrCreateSessionDto } from './dto/get-or-create-session.dto';
import { JwtAccessGuard } from '../../common/guards/jwt-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('attendance')
@UseGuards(JwtAccessGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * GET /api/attendance/today
   * Danh sách buổi học hôm nay theo lịch — ADMIN & TEACHER
   */
  @Get('today')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getTodaySessions(@CurrentUser() user: any) {
    return this.attendanceService.getTodaySessions(user);
  }

  /**
   * POST /api/attendance/sessions
   * Lấy hoặc tạo mới ClassSession cho buổi học hôm nay
   * Gọi khi teacher nhấn "Điểm danh" — đảm bảo session tồn tại trước khi mark
   */
  @Post('sessions')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getOrCreateSession(
    @Body() dto: GetOrCreateSessionDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.getOrCreateSession(dto, user);
  }

  /**
   * GET /api/attendance/sessions/:sessionId
   * Chi tiết buổi học + danh sách điểm danh + học sinh chưa điểm
   */
  @Get('sessions/:sessionId')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.getSession(sessionId, user);
  }

  /**
   * POST /api/attendance/sessions/:sessionId/mark
   * Điểm danh một học sinh — ADMIN & TEACHER
   */
  @Post('sessions/:sessionId/mark')
  @Roles(Role.ADMIN, Role.TEACHER)
  async markAttendance(
    @Param('sessionId') sessionId: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.markAttendance(sessionId, dto, user);
  }

  /**
   * POST /api/attendance/sessions/:sessionId/bulk-mark
   * Điểm danh nhiều học sinh cùng lúc
   */
  @Post('sessions/:sessionId/bulk-mark')
  @Roles(Role.ADMIN, Role.TEACHER)
  async bulkMarkAttendance(
    @Param('sessionId') sessionId: string,
    @Body('records') records: { studentId: string; status: string }[],
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.bulkMarkAttendance(sessionId, records, user);
  }

  /**
   * PATCH /api/attendance/sessions/:sessionId/complete
   * Kết thúc buổi học — ADMIN & TEACHER
   */
  @Patch('sessions/:sessionId/complete')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  async completeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.completeSession(sessionId, user);
  }

  /**
   * GET /api/attendance/class/:classId/history
   * Lịch sử các buổi học của một lớp
   */
  @Get('class/:classId/history')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getSessionsHistory(
    @Param('classId') classId: string,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.getSessionsHistory(classId, user);
  }
}
