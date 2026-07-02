import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { JwtAccessGuard } from '../../common/guards/jwt-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('schedule')
@UseGuards(JwtAccessGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /**
   * GET /api/schedule
   * Toàn bộ thời khoá biểu (theo quyền của user):
   *   ADMIN  → tất cả lớp
   *   TEACHER → chỉ lớp mình dạy
   *   STUDENT → chỉ lớp mình đã đăng ký
   */
  @Get()
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  async getSchedule(@CurrentUser() user: any) {
    return this.scheduleService.getSchedule(user);
  }

  /**
   * GET /api/schedule/class/:classId
   * Lịch học của một lớp cụ thể — ADMIN & TEACHER (phải là GV của lớp)
   */
  @Get('class/:classId')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getByClass(@Param('classId') classId: string, @CurrentUser() user: any) {
    return this.scheduleService.getByClass(classId, user);
  }

  /**
   * POST /api/schedule
   * Tạo buổi lịch học mới — ADMIN only
   */
  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateScheduleDto, @CurrentUser() user: any) {
    return this.scheduleService.create(dto, user);
  }

  /**
   * PATCH /api/schedule/:id
   * Cập nhật buổi lịch học — ADMIN only
   */
  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: any,
  ) {
    return this.scheduleService.update(id, dto, user);
  }

  /**
   * DELETE /api/schedule/:id
   * Xóa buổi lịch học — ADMIN only
   */
  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.scheduleService.remove(id, user);
  }
}
