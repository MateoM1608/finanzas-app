-- CreateEnum
CREATE TYPE "TipoInversion" AS ENUM ('cdt', 'fondo', 'acciones', 'cripto', 'finca_raiz', 'otro');

-- CreateEnum
CREATE TYPE "TipoMovimientoAhorro" AS ENUM ('aporte', 'retiro');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrigenGasto" ADD VALUE 'aporte_inversion';
ALTER TYPE "OrigenGasto" ADD VALUE 'retiro_inversion';
ALTER TYPE "OrigenGasto" ADD VALUE 'aporte_meta_hogar';
ALTER TYPE "OrigenGasto" ADD VALUE 'retiro_meta_hogar';

-- AlterTable
ALTER TABLE "gastos_personales" ADD COLUMN     "inversion_mov_id" TEXT,
ADD COLUMN     "meta_hogar_mov_id" TEXT;

-- AlterTable
ALTER TABLE "ingresos_personales" ADD COLUMN     "inversion_mov_id" TEXT,
ADD COLUMN     "meta_hogar_mov_id" TEXT;

-- CreateTable
CREATE TABLE "inversiones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "hogar_id" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoInversion" NOT NULL DEFAULT 'otro',
    "entidad" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "tasa_ea" DOUBLE PRECISION,
    "fecha_vencimiento" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inversiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inversion_movimientos" (
    "id" TEXT NOT NULL,
    "inversion_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "TipoMovimientoAhorro" NOT NULL,
    "monto" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "metodo_pago_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inversion_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inversion_valoraciones" (
    "id" TEXT NOT NULL,
    "inversion_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "valor" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inversion_valoraciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metas_hogar" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "creado_por_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto_meta" INTEGER NOT NULL,
    "fecha_meta" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metas_hogar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_hogar_movimientos" (
    "id" TEXT NOT NULL,
    "meta_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "TipoMovimientoAhorro" NOT NULL,
    "monto" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "metodo_pago_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_hogar_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inversiones_usuario_id_idx" ON "inversiones"("usuario_id");

-- CreateIndex
CREATE INDEX "inversiones_hogar_id_idx" ON "inversiones"("hogar_id");

-- CreateIndex
CREATE INDEX "inversion_movimientos_inversion_id_idx" ON "inversion_movimientos"("inversion_id");

-- CreateIndex
CREATE UNIQUE INDEX "inversion_valoraciones_inversion_id_fecha_key" ON "inversion_valoraciones"("inversion_id", "fecha");

-- CreateIndex
CREATE INDEX "metas_hogar_hogar_id_idx" ON "metas_hogar"("hogar_id");

-- CreateIndex
CREATE INDEX "meta_hogar_movimientos_meta_id_idx" ON "meta_hogar_movimientos"("meta_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_inversion_mov_id_key" ON "gastos_personales"("inversion_mov_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_meta_hogar_mov_id_key" ON "gastos_personales"("meta_hogar_mov_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_personales_inversion_mov_id_key" ON "ingresos_personales"("inversion_mov_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_personales_meta_hogar_mov_id_key" ON "ingresos_personales"("meta_hogar_mov_id");

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_inversion_mov_id_fkey" FOREIGN KEY ("inversion_mov_id") REFERENCES "inversion_movimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_meta_hogar_mov_id_fkey" FOREIGN KEY ("meta_hogar_mov_id") REFERENCES "meta_hogar_movimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_personales" ADD CONSTRAINT "ingresos_personales_inversion_mov_id_fkey" FOREIGN KEY ("inversion_mov_id") REFERENCES "inversion_movimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_personales" ADD CONSTRAINT "ingresos_personales_meta_hogar_mov_id_fkey" FOREIGN KEY ("meta_hogar_mov_id") REFERENCES "meta_hogar_movimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inversiones" ADD CONSTRAINT "inversiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inversiones" ADD CONSTRAINT "inversiones_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inversion_movimientos" ADD CONSTRAINT "inversion_movimientos_inversion_id_fkey" FOREIGN KEY ("inversion_id") REFERENCES "inversiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inversion_movimientos" ADD CONSTRAINT "inversion_movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inversion_movimientos" ADD CONSTRAINT "inversion_movimientos_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inversion_valoraciones" ADD CONSTRAINT "inversion_valoraciones_inversion_id_fkey" FOREIGN KEY ("inversion_id") REFERENCES "inversiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_hogar" ADD CONSTRAINT "metas_hogar_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_hogar" ADD CONSTRAINT "metas_hogar_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_hogar_movimientos" ADD CONSTRAINT "meta_hogar_movimientos_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "metas_hogar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_hogar_movimientos" ADD CONSTRAINT "meta_hogar_movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_hogar_movimientos" ADD CONSTRAINT "meta_hogar_movimientos_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

