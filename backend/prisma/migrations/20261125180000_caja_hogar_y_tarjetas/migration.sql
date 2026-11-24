-- Separa caja (movimientos, Disponible) de consumo (informes): los gastos
-- personales "Hogar · mes" del modelo anterior (origen cuadre_hogar) se
-- reemplazan por el pago al 100 % (pago_hogar) y el reintegro del cuadre
-- (liquidacion_hogar); la parte de consumo se calcula desde el hogar.
DELETE FROM "gastos_personales" WHERE "origen" = 'cuadre_hogar';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrigenGasto" ADD VALUE 'pago_hogar';
ALTER TYPE "OrigenGasto" ADD VALUE 'liquidacion_hogar';
ALTER TYPE "OrigenGasto" ADD VALUE 'pago_tarjeta';

-- AlterTable
ALTER TABLE "gastos_personales" ADD COLUMN     "pago_cuota_hogar_id" TEXT,
ADD COLUMN     "pago_gasto_hogar_id" TEXT,
ADD COLUMN     "tarjeta_pagada_id" TEXT;

-- AlterTable
ALTER TABLE "ingresos_personales" ADD COLUMN     "origen_cuadre_id" TEXT;

-- AlterTable
ALTER TABLE "gastos_recurrentes_instancia" ADD COLUMN     "metodo_pago_id" TEXT;

-- AlterTable
ALTER TABLE "gastos_variables_pareja" ADD COLUMN     "metodo_pago_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_pago_cuota_hogar_id_key" ON "gastos_personales"("pago_cuota_hogar_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_pago_gasto_hogar_id_key" ON "gastos_personales"("pago_gasto_hogar_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_personales_origen_cuadre_id_usuario_id_key" ON "ingresos_personales"("origen_cuadre_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_pago_cuota_hogar_id_fkey" FOREIGN KEY ("pago_cuota_hogar_id") REFERENCES "gastos_recurrentes_instancia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_pago_gasto_hogar_id_fkey" FOREIGN KEY ("pago_gasto_hogar_id") REFERENCES "gastos_variables_pareja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_tarjeta_pagada_id_fkey" FOREIGN KEY ("tarjeta_pagada_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_personales" ADD CONSTRAINT "ingresos_personales_origen_cuadre_id_fkey" FOREIGN KEY ("origen_cuadre_id") REFERENCES "cuadres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes_instancia" ADD CONSTRAINT "gastos_recurrentes_instancia_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_variables_pareja" ADD CONSTRAINT "gastos_variables_pareja_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

