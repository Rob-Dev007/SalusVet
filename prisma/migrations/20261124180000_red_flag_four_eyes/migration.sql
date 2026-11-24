-- Migración ADITIVA: solo agrega columnas opcionales (o con DEFAULT) y restricciones que las filas
-- actuales ya cumplen. No reescribe datos: segura de aplicar con la app funcionando.

-- AlterTable
ALTER TABLE "RedFlagKeyword" ADD COLUMN     "deactivationReason" TEXT,
ADD COLUMN     "deactivationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deactivationRequestedById" TEXT,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedById" TEXT;

-- AddForeignKey
ALTER TABLE "RedFlagKeyword" ADD CONSTRAINT "RedFlagKeyword_deactivationRequestedById_fkey" FOREIGN KEY ("deactivationRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedFlagKeyword" ADD CONSTRAINT "RedFlagKeyword_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- INVARIANTES EN LA BD (escritas a mano: Prisma no modela CHECK). Son la última barrera: aunque
-- un bug del servicio o un script mal hecho lo intente, Postgres rechaza la fila.

-- Una alerta protegida nunca puede estar inactiva.
ALTER TABLE "RedFlagKeyword" ADD CONSTRAINT "RedFlagKeyword_locked_implies_active"
  CHECK (NOT "locked" OR "active");

-- Cuatro ojos: quien aprobó la baja no puede ser quien la pidió. (Si alguno es NULL, porque la
-- baja es anterior a esta regla o el usuario se eliminó, no hay nada que comparar.)
ALTER TABLE "RedFlagKeyword" ADD CONSTRAINT "RedFlagKeyword_four_eyes"
  CHECK ("deactivatedById" IS NULL OR "deactivationRequestedById" IS NULL OR "deactivatedById" <> "deactivationRequestedById");
