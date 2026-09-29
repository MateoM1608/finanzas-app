-- DropIndex
DROP INDEX "cortes_hogar_id_fecha_nominal_key";

-- AlterTable
ALTER TABLE "cortes" ADD COLUMN     "secuencia" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ingresos_personales" ADD COLUMN     "descripcion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cortes_hogar_id_fecha_nominal_secuencia_key" ON "cortes"("hogar_id", "fecha_nominal", "secuencia");


-- Backfill: los ingresos ya generados por un ingreso fijo toman su nombre
-- como descripción (igual que hacen los gastos fijos desde la Etapa 1).
UPDATE "ingresos_personales" AS i
SET "descripcion" = c."nombre"
FROM "ingresos_fijos_config" AS c
WHERE i."origen_config_id" = c."id" AND i."descripcion" IS NULL;
