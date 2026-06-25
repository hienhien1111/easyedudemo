import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) {}

  async findAll() {
    return this.prismaService.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            enrollments: true,
            taughtClasses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prismaService.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            enrollments: true,
            taughtClasses: true,
          },
        },
      },
    });
  }

  async getMyProfile(userId: string) {
    const user = await this.prismaService.user.findUnique({
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

    return user;
  }
}
