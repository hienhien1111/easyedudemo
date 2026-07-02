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
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtAccessGuard } from '../../common/guards/jwt-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('classes')
@UseGuards(JwtAccessGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /**
   * GET /api/classes
   * Danh sách lớp học — ADMIN thấy tất cả, TEACHER chỉ thấy lớp mình dạy
   */
  @Get()
  @Roles(Role.ADMIN, Role.TEACHER)
  async findAll(@CurrentUser() user: any) {
    return this.classesService.findAll(user);
  }

  /**
   * GET /api/classes/teachers
   * Danh sách giáo viên để gán vào lớp — ADMIN only
   */
  @Get('teachers')
  @Roles(Role.ADMIN)
  async getTeachers() {
    return this.classesService.getTeachers();
  }

  /**
   * GET /api/classes/centers
   * Danh sách trung tâm để gán vào lớp — ADMIN only
   */
  @Get('centers')
  @Roles(Role.ADMIN)
  async getCenters() {
    return this.classesService.getCenters();
  }

  /**
   * GET /api/classes/:id
   * Chi tiết một lớp học — ADMIN hoặc TEACHER (phải là giáo viên của lớp)
   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.classesService.findOne(id, user);
  }

  /**
   * POST /api/classes
   * Tạo lớp học mới — ADMIN only
   */
  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateClassDto) {
    return this.classesService.create(dto);
  }

  /**
   * PATCH /api/classes/:id
   * Cập nhật lớp học — ADMIN only (bao gồm gán lại giáo viên)
   */
  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.classesService.update(id, dto);
  }

  /**
   * DELETE /api/classes/:id
   * Xóa lớp học — ADMIN only (chỉ khi chưa có học sinh)
   */
  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.classesService.remove(id);
  }

  /**
   * GET /api/classes/:id/students
   * Lấy danh sách học viên của lớp
   */
  @Get(':id/students')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getStudents(@Param('id') id: string, @CurrentUser() user: any) {
    return this.classesService.getStudents(id, user);
  }

  /**
   * POST /api/classes/:id/students
   * Thêm học viên vào lớp
   */
  @Post(':id/students')
  @Roles(Role.ADMIN, Role.TEACHER)
  async addStudents(
    @Param('id') id: string,
    @Body('studentIds') studentIds: string[],
    @CurrentUser() user: any
  ) {
    return this.classesService.addStudents(id, studentIds, user);
  }

  /**
   * DELETE /api/classes/:id/students/:studentId
   * Xóa học viên khỏi lớp
   */
  @Delete(':id/students/:studentId')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  async removeStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: any
  ) {
    return this.classesService.removeStudent(id, studentId, user);
  }
}
