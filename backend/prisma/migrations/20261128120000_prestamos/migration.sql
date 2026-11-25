-- CreateEnum
CREATE TYPE "TipoPrestamo" AS ENUM ('libre_inversion', 'vehiculo', 'vivienda', 'educativo', 'persona', 'otro');

-- CreateEnum
CREATE TYPE "ModoAbonoPrestamo" AS ENUM ('reducir_plazo', 'reducir_cuota');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrigenGasto" ADD VALUE 'abono_prestamo';
ALTER TYPE "OrigenGasto" ADD VALUE 'desembolso_prestamo';

-- AlterTable
ALTER TABLE "gastos_personales" ADD COLUMN     "abono_prestamo_id" TEXT,
ADD COLUMN     "fecha_vencimiento" TIMESTAMP(3),
ADD COLUMN     "mora" INTEGER,
ADD COLUMN     "prestamo_id" TEXT,
ADD COLUMN     "seguro" INTEGER;

-- AlterTable
ALTER TABLE "gastos_variables_pareja" ADD COLUMN     "abono_prestamo_id" TEXT,
ADD COLUMN     "mora" INTEGER,
ADD COLUMN     "prestamo_id" TEXT,
ADD COLUMN     "seguro" INTEGER;

-- CreateTable
CREATE TABLE "prestamos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "hogar_id" TEXT,
    "nombre" TEXT NOT NULL,
    "entidad" TEXT,
    "tipo" "TipoPrestamo" NOT NULL DEFAULT 'otro',
    "monto_prestado" INTEGER NOT NULL,
    "saldo_inicial" INTEGER NOT NULL,
    "cuotas_previas" INTEGER NOT NULL DEFAULT 0,
    "numero_cuotas" INTEGER NOT NULL,
    "tasa_mensual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tasa_ingresada" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tasa_es_anual" BOOLEAN NOT NULL DEFAULT false,
    "sistema_interes" "SistemaInteres" NOT NULL DEFAULT 'cuota_fija',
    "seguro_mensual" INTEGER NOT NULL DEFAULT 0,
    "fecha_desembolso" TIMESTAMP(3),
    "fecha_primera_cuota" TIMESTAMP(3) NOT NULL,
    "modo_cobro" "ModoFijoPersonal" NOT NULL DEFAULT 'manual',
    "metodo_pago_id" TEXT,
    "pago_usuario_id" TEXT,
    "categoria_id" TEXT,
    "desembolso_ingreso_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prestamos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestamo_abonos" (
    "id" TEXT NOT NULL,
    "prestamo_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" INTEGER NOT NULL,
    "modo" "ModoAbonoPrestamo" NOT NULL,
    "metodo_pago_id" TEXT,
    "pago_usuario_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prestamo_abonos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prestamos_desembolso_ingreso_id_key" ON "prestamos"("desembolso_ingreso_id");

-- CreateIndex
CREATE INDEX "prestamos_usuario_id_idx" ON "prestamos"("usuario_id");

-- CreateIndex
CREATE INDEX "prestamos_hogar_id_idx" ON "prestamos"("hogar_id");

-- CreateIndex
CREATE INDEX "prestamo_abonos_prestamo_id_idx" ON "prestamo_abonos"("prestamo_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_abono_prestamo_id_key" ON "gastos_personales"("abono_prestamo_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_prestamo_id_numero_cuota_key" ON "gastos_personales"("prestamo_id", "numero_cuota");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_variables_pareja_abono_prestamo_id_key" ON "gastos_variables_pareja"("abono_prestamo_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_variables_pareja_prestamo_id_numero_cuota_key" ON "gastos_variables_pareja"("prestamo_id", "numero_cuota");

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_abono_prestamo_id_fkey" FOREIGN KEY ("abono_prestamo_id") REFERENCES "prestamo_abonos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_variables_pareja" ADD CONSTRAINT "gastos_variables_pareja_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_variables_pareja" ADD CONSTRAINT "gastos_variables_pareja_abono_prestamo_id_fkey" FOREIGN KEY ("abono_prestamo_id") REFERENCES "prestamo_abonos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_pago_usuario_id_fkey" FOREIGN KEY ("pago_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_desembolso_ingreso_id_fkey" FOREIGN KEY ("desembolso_ingreso_id") REFERENCES "ingresos_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamo_abonos" ADD CONSTRAINT "prestamo_abonos_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamo_abonos" ADD CONSTRAINT "prestamo_abonos_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

