-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PERSONAL');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MANANA', 'TARDE', 'NOCHE', 'ROTATIVO');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('HACER_ECOGRAFIA', 'SOLO_INFORME');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('ECOGRAFIA', 'TOMOGRAFIA');

-- CreateEnum
CREATE TYPE "OrderOrigin" AS ENUM ('POR_SU_CUENTA', 'RECOMENDACION', 'PROMOCION');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('EN_ESPERA', 'EN_ATENCION', 'ATENDIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'QR', 'MIXTO', 'POR_COMPROMISO');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDIENTE', 'PAGADA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PERSONAL',
    "shift" "Shift" NOT NULL DEFAULT 'MANANA',
    "canApplyPromotions" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssociatedDoctor" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "hospitalOrClinic" TEXT,
    "agreedCommission" DECIMAL(10,2) NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssociatedDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "reportCategory" "ReportCategory",
    "normalPrice" DECIMAL(10,2) NOT NULL,
    "promoPrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFormat" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studyServiceId" TEXT NOT NULL,
    "documentHtml" TEXT NOT NULL,
    "boundingBoxes" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "origin" "OrderOrigin" NOT NULL DEFAULT 'POR_SU_CUENTA',
    "associatedDoctorId" TEXT,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "emergencySurcharge" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "queuePriority" INTEGER NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'EN_ESPERA',
    "subtotalStudies" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amountCash" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "amountQr" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "isCommitmentPaid" BOOLEAN NOT NULL DEFAULT false,
    "commitmentPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "studyServiceId" TEXT NOT NULL,
    "priceApplied" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorCommission" (
    "id" TEXT NOT NULL,
    "associatedDoctorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientReport" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "fieldValues" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_ci_key" ON "User"("ci");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");

-- CreateIndex
CREATE INDEX "AssociatedDoctor_fullName_isActive_idx" ON "AssociatedDoctor"("fullName", "isActive");

-- CreateIndex
CREATE INDEX "StudyService_serviceType_isActive_idx" ON "StudyService"("serviceType", "isActive");

-- CreateIndex
CREATE INDEX "ReportFormat_studyServiceId_idx" ON "ReportFormat"("studyServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_status_queuePriority_idx" ON "Order"("status", "queuePriority");

-- CreateIndex
CREATE INDEX "Order_paymentMethod_isCommitmentPaid_idx" ON "Order"("paymentMethod", "isCommitmentPaid");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorCommission_orderId_key" ON "DoctorCommission"("orderId");

-- CreateIndex
CREATE INDEX "DoctorCommission_associatedDoctorId_status_idx" ON "DoctorCommission"("associatedDoctorId", "status");

-- CreateIndex
CREATE INDEX "DoctorCommission_createdAt_idx" ON "DoctorCommission"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientReport_orderItemId_key" ON "PatientReport"("orderItemId");

-- CreateIndex
CREATE INDEX "PatientReport_generatedById_idx" ON "PatientReport"("generatedById");

-- AddForeignKey
ALTER TABLE "ReportFormat" ADD CONSTRAINT "ReportFormat_studyServiceId_fkey" FOREIGN KEY ("studyServiceId") REFERENCES "StudyService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_associatedDoctorId_fkey" FOREIGN KEY ("associatedDoctorId") REFERENCES "AssociatedDoctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_studyServiceId_fkey" FOREIGN KEY ("studyServiceId") REFERENCES "StudyService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorCommission" ADD CONSTRAINT "DoctorCommission_associatedDoctorId_fkey" FOREIGN KEY ("associatedDoctorId") REFERENCES "AssociatedDoctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorCommission" ADD CONSTRAINT "DoctorCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientReport" ADD CONSTRAINT "PatientReport_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientReport" ADD CONSTRAINT "PatientReport_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "ReportFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientReport" ADD CONSTRAINT "PatientReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
