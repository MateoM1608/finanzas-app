-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrigenGasto" ADD VALUE 'aporte_ahorro';
ALTER TYPE "OrigenGasto" ADD VALUE 'retiro_ahorro';

-- AlterTable
ALTER TABLE "ahorro_transacciones" ADD COLUMN     "metodo_pago_id" TEXT,
ADD COLUMN     "tipo" "TipoMovimientoAhorro" NOT NULL DEFAULT 'aporte';

-- AlterTable
ALTER TABLE "gastos_personales" ADD COLUMN     "ahorro_transaccion_id" TEXT;

-- AlterTable
ALTER TABLE "ingresos_personales" ADD COLUMN     "ahorro_transaccion_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_ahorro_transaccion_id_key" ON "gastos_personales"("ahorro_transaccion_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_personales_ahorro_transaccion_id_key" ON "ingresos_personales"("ahorro_transaccion_id");

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_ahorro_transaccion_id_fkey" FOREIGN KEY ("ahorro_transaccion_id") REFERENCES "ahorro_transacciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_personales" ADD CONSTRAINT "ingresos_personales_ahorro_transaccion_id_fkey" FOREIGN KEY ("ahorro_transaccion_id") REFERENCES "ahorro_transacciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahorro_transacciones" ADD CONSTRAINT "ahorro_transacciones_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

