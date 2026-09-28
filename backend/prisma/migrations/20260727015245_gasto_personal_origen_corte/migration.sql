-- AlterEnum
ALTER TYPE "OrigenGasto" ADD VALUE 'corte_hogar';

-- AlterTable
ALTER TABLE "gastos_personales" ADD COLUMN     "origen_corte_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_origen_corte_id_usuario_id_key" ON "gastos_personales"("origen_corte_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_origen_corte_id_fkey" FOREIGN KEY ("origen_corte_id") REFERENCES "cortes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

