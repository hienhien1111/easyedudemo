/*
  Warnings:

  - The `status` column on the `enrollments` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DROPPED');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT_EXCUSED', 'ABSENT_UNEXCUSED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "description" TEXT,
ADD COLUMN     "price_per_session" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "start_date" SET DATA TYPE DATE,
ALTER COLUMN "end_date" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "status",
ADD COLUMN     "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bank_account_name" TEXT,
ADD COLUMN     "bank_account_no" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "commission_rate" DECIMAL(5,4),
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "weekly_schedule_templates" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_schedule_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "template_id" TEXT,
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room" TEXT,
    "notes" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "marked_by" TEXT NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_invoices" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "momo_order_id" TEXT,
    "momo_transaction_id" TEXT,
    "momo_pay_url" TEXT,
    "momo_raw_status" TEXT,
    "created_by" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "price_per_session" DECIMAL(12,2) NOT NULL,
    "present_count" INTEGER NOT NULL DEFAULT 0,
    "absent_excused_count" INTEGER NOT NULL DEFAULT 0,
    "absent_unexcused_count" INTEGER NOT NULL DEFAULT 0,
    "line_amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "student_invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_salary_invoices" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL,
    "total_student_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "calculated_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "SalaryStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "bank_account_name" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_salary_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_line_items" (
    "id" TEXT NOT NULL,
    "salary_invoice_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "session_count" INTEGER NOT NULL,
    "student_revenue_for_class" DECIMAL(12,2) NOT NULL,
    "line_amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "salary_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_schedule_templates_class_id_idx" ON "weekly_schedule_templates"("class_id");

-- CreateIndex
CREATE INDEX "class_sessions_class_id_idx" ON "class_sessions"("class_id");

-- CreateIndex
CREATE INDEX "class_sessions_date_idx" ON "class_sessions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_class_id_date_start_time_key" ON "class_sessions"("class_id", "date", "start_time");

-- CreateIndex
CREATE INDEX "attendance_records_session_id_idx" ON "attendance_records"("session_id");

-- CreateIndex
CREATE INDEX "attendance_records_student_id_idx" ON "attendance_records"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_student_id_key" ON "attendance_records"("session_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_invoices_momo_order_id_key" ON "student_invoices"("momo_order_id");

-- CreateIndex
CREATE INDEX "student_invoices_student_id_idx" ON "student_invoices"("student_id");

-- CreateIndex
CREATE INDEX "student_invoices_status_idx" ON "student_invoices"("status");

-- CreateIndex
CREATE INDEX "student_invoices_period_start_period_end_idx" ON "student_invoices"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "student_invoice_line_items_invoice_id_idx" ON "student_invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "student_invoice_line_items_class_id_idx" ON "student_invoice_line_items"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_invoice_line_items_invoice_id_class_id_key" ON "student_invoice_line_items"("invoice_id", "class_id");

-- CreateIndex
CREATE INDEX "teacher_salary_invoices_teacher_id_idx" ON "teacher_salary_invoices"("teacher_id");

-- CreateIndex
CREATE INDEX "teacher_salary_invoices_status_idx" ON "teacher_salary_invoices"("status");

-- CreateIndex
CREATE INDEX "salary_line_items_salary_invoice_id_idx" ON "salary_line_items"("salary_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_line_items_salary_invoice_id_class_id_key" ON "salary_line_items"("salary_invoice_id", "class_id");

-- AddForeignKey
ALTER TABLE "weekly_schedule_templates" ADD CONSTRAINT "weekly_schedule_templates_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "weekly_schedule_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoice_line_items" ADD CONSTRAINT "student_invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "student_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_invoice_line_items" ADD CONSTRAINT "student_invoice_line_items_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_salary_invoices" ADD CONSTRAINT "teacher_salary_invoices_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_salary_invoices" ADD CONSTRAINT "teacher_salary_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_salary_invoices" ADD CONSTRAINT "teacher_salary_invoices_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_line_items" ADD CONSTRAINT "salary_line_items_salary_invoice_id_fkey" FOREIGN KEY ("salary_invoice_id") REFERENCES "teacher_salary_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_line_items" ADD CONSTRAINT "salary_line_items_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
