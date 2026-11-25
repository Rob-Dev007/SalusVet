-- Migración ADITIVA: ningún dato existente cambia de significado.

-- Nuevo valor del enum. BEFORE 'OTHER' lo ubica en el mismo orden que en schema.prisma ("Otro"
-- siempre al final). Postgres permite AGREGAR valores a un enum, pero no quitarlos ni renombrarlos
-- con facilidad: por eso pensamos bien el nombre antes de crearlo.
ALTER TYPE "Species" ADD VALUE 'CATTLE' BEFORE 'OTHER';

-- Peso: de DECIMAL(5,2) (máx. 999.99) a DECIMAL(6,2) (máx. 9999.99). AMPLIAR la precisión sin
-- cambiar la escala es seguro: todo valor que cabía antes cabe ahora, y Postgres no reescribe la tabla.
ALTER TABLE "Pet" ALTER COLUMN "weightKg" SET DATA TYPE DECIMAL(6,2);
