-- Migración ADITIVA: solo crea una tabla nueva. No toca datos existentes (segura de aplicar).

-- CreateTable
CREATE TABLE "RedFlagKeyword" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "RedFlagKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedFlagKeyword_phrase_key" ON "RedFlagKeyword"("phrase");

-- CreateIndex
CREATE INDEX "RedFlagKeyword_active_idx" ON "RedFlagKeyword"("active");

-- AddForeignKey
ALTER TABLE "RedFlagKeyword" ADD CONSTRAINT "RedFlagKeyword_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedFlagKeyword" ADD CONSTRAINT "RedFlagKeyword_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
