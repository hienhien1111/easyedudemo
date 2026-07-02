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
import { Role } from '@prisma/client';

@Controller('classes')
@UseGuards(JwtAccessGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /**
   * GET /api/classes
   * Danh sách tất cả lớp học — ADMIN only
   */
  @Get()
  @Roles(Role.ADMIN)
  async findAll() {
    return this.classesService.findAll();
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
   * Chi tiết một lớp học — ADMIN only
   */
  @Get(':id')
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.classesService.findOne(id);
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
}
