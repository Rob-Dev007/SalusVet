-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'VET', 'ADMIN');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "Species" AS ENUM ('DOG', 'CAT', 'BIRD', 'RABBIT', 'REPTILE', 'OTHER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "breed" TEXT,
    "sex" "Sex" NOT NULL DEFAULT 'UNKNOWN',
    "birthDate" DATE,
    "weightKg" DECIMAL(5,2),
    "notes" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "reason" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "petId" TEXT NOT NULL,
    "vetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentStatusChange" (
    "id" TEXT NOT NULL,
    "fromStatus" "AppointmentStatus",
    "toStatus" "AppointmentStatus" NOT NULL,
    "note" TEXT,
    "appointmentId" TEXT NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreConsultation" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "symptoms" TEXT[],
    "urgency" "UrgencyLevel" NOT NULL,
    "structuredData" JSONB NOT NULL,
    "aiModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreConsultation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Pet_ownerId_idx" ON "Pet"("ownerId");

-- CreateIndex
CREATE INDEX "Appointment_vetId_scheduledAt_idx" ON "Appointment"("vetId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_petId_idx" ON "Appointment"("petId");

-- CreateIndex
CREATE INDEX "Appointment_status_scheduledAt_idx" ON "Appointment"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AppointmentStatusChange_appointmentId_createdAt_idx" ON "AppointmentStatusChange"("appointmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PreConsultation_appointmentId_key" ON "PreConsultation"("appointmentId");

-- CreateIndex
CREATE INDEX "PreConsultation_urgency_idx" ON "PreConsultation"("urgency");

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStatusChange" ADD CONSTRAINT "AppointmentStatusChange_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStatusChange" ADD CONSTRAINT "AppointmentStatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreConsultation" ADD CONSTRAINT "PreConsultation_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
