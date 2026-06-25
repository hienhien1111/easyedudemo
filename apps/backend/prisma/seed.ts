import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data in proper order
  await prisma.enrollment.deleteMany();
  await prisma.class.deleteMany();
  await prisma.center.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const SALT_ROUNDS = 10;

  // ─── Create Users ──────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);
  const teacherPassword = await bcrypt.hash('Teacher@123', SALT_ROUNDS);
  const studentPassword = await bcrypt.hash('Student@123', SALT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@eedemo.com',
      passwordHash: adminPassword,
      fullName: 'System Admin',
      role: Role.ADMIN,
    },
  });

  const teacher1 = await prisma.user.create({
    data: {
      email: 'teacher@eedemo.com',
      passwordHash: teacherPassword,
      fullName: 'Nguyen Van A',
      role: Role.TEACHER,
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      email: 'teacher2@eedemo.com',
      passwordHash: teacherPassword,
      fullName: 'Tran Thi B',
      role: Role.TEACHER,
    },
  });

  const student1 = await prisma.user.create({
    data: {
      email: 'student@eedemo.com',
      passwordHash: studentPassword,
      fullName: 'Le Van C',
      role: Role.STUDENT,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: 'student2@eedemo.com',
      passwordHash: studentPassword,
      fullName: 'Pham Thi D',
      role: Role.STUDENT,
    },
  });

  // ─── Create Centers ────────────────────────────────────────────────────────
  const center1 = await prisma.center.create({
    data: {
      name: 'Trung tâm EE Demo - Chi nhánh 1',
      address: '123 Nguyen Hue, Quan 1, TP.HCM',
      phone: '028-1234-5678',
    },
  });

  const center2 = await prisma.center.create({
    data: {
      name: 'Trung tâm EE Demo - Chi nhánh 2',
      address: '456 Le Loi, Quan 3, TP.HCM',
      phone: '028-9876-5432',
    },
  });

  // ─── Create Classes ────────────────────────────────────────────────────────
  const class1 = await prisma.class.create({
    data: {
      name: 'Lập trình Python cơ bản',
      centerId: center1.id,
      teacherId: teacher1.id,
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-04-15'),
    },
  });

  const class2 = await prisma.class.create({
    data: {
      name: 'Toán học nâng cao',
      centerId: center1.id,
      teacherId: teacher2.id,
      startDate: new Date('2025-02-01'),
      endDate: new Date('2025-05-31'),
    },
  });

  const class3 = await prisma.class.create({
    data: {
      name: 'Tiếng Anh giao tiếp',
      centerId: center2.id,
      teacherId: teacher1.id,
      startDate: new Date('2025-01-20'),
      endDate: new Date('2025-07-20'),
    },
  });

  // ─── Create Enrollments ────────────────────────────────────────────────────
  await prisma.enrollment.createMany({
    data: [
      { studentId: student1.id, classId: class1.id },
      { studentId: student1.id, classId: class3.id },
      { studentId: student2.id, classId: class1.id },
      { studentId: student2.id, classId: class2.id },
    ],
  });

  console.log('✅ Seed completed successfully!');
  console.log('\n📋 Demo accounts:');
  console.log('  Admin:    admin@eedemo.com     / Admin@123');
  console.log('  Teacher:  teacher@eedemo.com   / Teacher@123');
  console.log('  Teacher2: teacher2@eedemo.com  / Teacher@123');
  console.log('  Student:  student@eedemo.com   / Student@123');
  console.log('  Student2: student2@eedemo.com  / Student@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
