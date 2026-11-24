-- Cuadres abiertos (reemplaza el motor de cortes por fechas nominales).
-- "Hogar limpio", decidido con el usuario: se borran todos los datos de
-- cortes, cuentas fijas (conceptos + cuotas) y gastos variables del hogar,
-- y los gastos personales que generaron los cortes. Se conservan usuarios,
-- hogares, miembros, permisos, split y todo el panel personal.
DELETE FROM "gastos_personales" WHERE "origen" = 'corte_hogar';
DELETE FROM "corte_balance_miembro";
DELETE FROM "corte_items";
DELETE FROM "cortes";
DELETE FROM "gastos_recurrentes_instancia_reparto";
DELETE FROM "gastos_recurrentes_instancia";
DELETE FROM "gastos_variables_pareja_reparto";
DELETE FROM "gastos_variables_pareja";
DELETE FROM "concepto_puntos_corte";
DELETE FROM "conceptos_recurrentes_pareja";

-- CreateEnum
CREATE TYPE "FrecuenciaCuentaFija" AS ENUM ('mensual', 'quincenal');

-- CreateEnum
CREATE TYPE "EstadoGastoHogar" AS ENUM ('por_pagar', 'pagado', 'en_cuadre', 'cuadrado');

-- CreateEnum
CREATE TYPE "EstadoCuadre" AS ENUM ('abierto', 'cerrado');

-- CreateEnum
CREATE TYPE "TipoOrigenCuadreItem" AS ENUM ('recurrente', 'variable');

-- AlterEnum
BEGIN;
CREATE TYPE "OrigenGasto_new" AS ENUM ('app', 'bot', 'cuadre_hogar');
ALTER TABLE "gastos_personales" ALTER COLUMN "origen" DROP DEFAULT;
ALTER TABLE "ingresos_personales" ALTER COLUMN "origen" DROP DEFAULT;
ALTER TABLE "gastos_personales" ALTER COLUMN "origen" TYPE "OrigenGasto_new" USING ("origen"::text::"OrigenGasto_new");
ALTER TABLE "ingresos_personales" ALTER COLUMN "origen" TYPE "OrigenGasto_new" USING ("origen"::text::"OrigenGasto_new");
ALTER TYPE "OrigenGasto" RENAME TO "OrigenGasto_old";
ALTER TYPE "OrigenGasto_new" RENAME TO "OrigenGasto";
DROP TYPE "OrigenGasto_old";
ALTER TABLE "gastos_personales" ALTER COLUMN "origen" SET DEFAULT 'app';
ALTER TABLE "ingresos_personales" ALTER COLUMN "origen" SET DEFAULT 'app';
COMMIT;

-- DropForeignKey
ALTER TABLE "puntos_corte_hogar" DROP CONSTRAINT "puntos_corte_hogar_hogar_id_fkey";

-- DropForeignKey
ALTER TABLE "gastos_personales" DROP CONSTRAINT "gastos_personales_origen_corte_id_fkey";

-- DropForeignKey
ALTER TABLE "conceptos_recurrentes_pareja" DROP CONSTRAINT "conceptos_recurrentes_pareja_pagador_default_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "concepto_puntos_corte" DROP CONSTRAINT "concepto_puntos_corte_concepto_id_fkey";

-- DropForeignKey
ALTER TABLE "concepto_puntos_corte" DROP CONSTRAINT "concepto_puntos_corte_punto_corte_id_fkey";

-- DropForeignKey
ALTER TABLE "gastos_recurrentes_instancia" DROP CONSTRAINT "gastos_recurrentes_instancia_punto_corte_id_fkey";

-- DropForeignKey
ALTER TABLE "cortes" DROP CONSTRAINT "cortes_hogar_id_fkey";

-- DropForeignKey
ALTER TABLE "cortes" DROP CONSTRAINT "cortes_creado_por_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "corte_items" DROP CONSTRAINT "corte_items_corte_id_fkey";

-- DropForeignKey
ALTER TABLE "corte_balance_miembro" DROP CONSTRAINT "corte_balance_miembro_corte_id_fkey";

-- DropForeignKey
ALTER TABLE "corte_balance_miembro" DROP CONSTRAINT "corte_balance_miembro_usuario_id_fkey";

-- DropIndex
DROP INDEX "gastos_personales_origen_corte_id_usuario_id_key";

-- DropIndex
DROP INDEX "gastos_recurrentes_instancia_punto_corte_id_idx";

-- DropIndex
DROP INDEX "gastos_recurrentes_instancia_concepto_id_periodo_inicio_pun_key";

-- DropIndex
DROP INDEX "gastos_variables_pareja_hogar_id_idx";

-- AlterTable
ALTER TABLE "hogares" DROP COLUMN "frecuencia_corte";

-- AlterTable
ALTER TABLE "gastos_personales" DROP COLUMN "origen_corte_id",
ADD COLUMN     "origen_cuadre_id" TEXT;

-- AlterTable
ALTER TABLE "conceptos_recurrentes_pareja" DROP COLUMN "pagador_default_usuario_id",
ADD COLUMN     "dia_mes" INTEGER,
ADD COLUMN     "dia_mes_2" INTEGER,
ADD COLUMN     "fecha_inicio" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "frecuencia" "FrecuenciaCuentaFija" NOT NULL DEFAULT 'mensual',
ADD COLUMN     "responsable_usuario_id" TEXT;

-- AlterTable
ALTER TABLE "gastos_recurrentes_instancia" DROP COLUMN "fecha_nominal",
DROP COLUMN "periodo_inicio",
DROP COLUMN "punto_corte_id",
ADD COLUMN     "fecha" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fecha_pago" TIMESTAMP(3),
DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoGastoHogar" NOT NULL DEFAULT 'por_pagar';

-- AlterTable
ALTER TABLE "gastos_variables_pareja" DROP COLUMN "fecha_limite",
DROP COLUMN "fecha_pago_real",
ADD COLUMN     "fecha" TIMESTAMP(3) NOT NULL,
DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoGastoHogar" NOT NULL DEFAULT 'pagado';

-- DropTable
DROP TABLE "puntos_corte_hogar";

-- DropTable
DROP TABLE "concepto_puntos_corte";

-- DropTable
DROP TABLE "cortes";

-- DropTable
DROP TABLE "corte_items";

-- DropTable
DROP TABLE "corte_balance_miembro";

-- DropEnum
DROP TYPE "EstadoGastoPareja";

-- DropEnum
DROP TYPE "EstadoCorte";

-- DropEnum
DROP TYPE "TipoOrigenCorteItem";

-- CreateTable
CREATE TABLE "cuadres" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3),
    "estado" "EstadoCuadre" NOT NULL DEFAULT 'abierto',
    "creado_por_usuario_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrado_en" TIMESTAMP(3),

    CONSTRAINT "cuadres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuadre_items" (
    "id" TEXT NOT NULL,
    "cuadre_id" TEXT NOT NULL,
    "tipo_origen" "TipoOrigenCuadreItem" NOT NULL,
    "origen_id" TEXT NOT NULL,
    "incluido" BOOLEAN NOT NULL DEFAULT true,
    "monto" INTEGER NOT NULL,

    CONSTRAINT "cuadre_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuadre_balance_miembro" (
    "id" TEXT NOT NULL,
    "cuadre_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,

    CONSTRAINT "cuadre_balance_miembro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cuadres_hogar_id_estado_idx" ON "cuadres"("hogar_id", "estado");

-- CreateIndex
CREATE INDEX "cuadre_items_cuadre_id_idx" ON "cuadre_items"("cuadre_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuadre_items_cuadre_id_tipo_origen_origen_id_key" ON "cuadre_items"("cuadre_id", "tipo_origen", "origen_id");

-- CreateIndex
CREATE INDEX "cuadre_balance_miembro_cuadre_id_idx" ON "cuadre_balance_miembro"("cuadre_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuadre_balance_miembro_cuadre_id_usuario_id_key" ON "cuadre_balance_miembro"("cuadre_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_origen_cuadre_id_usuario_id_fecha_key" ON "gastos_personales"("origen_cuadre_id", "usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "gastos_recurrentes_instancia_concepto_id_estado_idx" ON "gastos_recurrentes_instancia"("concepto_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_recurrentes_instancia_concepto_id_fecha_key" ON "gastos_recurrentes_instancia"("concepto_id", "fecha");

-- CreateIndex
CREATE INDEX "gastos_variables_pareja_hogar_id_estado_idx" ON "gastos_variables_pareja"("hogar_id", "estado");

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_origen_cuadre_id_fkey" FOREIGN KEY ("origen_cuadre_id") REFERENCES "cuadres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conceptos_recurrentes_pareja" ADD CONSTRAINT "conceptos_recurrentes_pareja_responsable_usuario_id_fkey" FOREIGN KEY ("responsable_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadres" ADD CONSTRAINT "cuadres_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadres" ADD CONSTRAINT "cuadres_creado_por_usuario_id_fkey" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadre_items" ADD CONSTRAINT "cuadre_items_cuadre_id_fkey" FOREIGN KEY ("cuadre_id") REFERENCES "cuadres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadre_balance_miembro" ADD CONSTRAINT "cuadre_balance_miembro_cuadre_id_fkey" FOREIGN KEY ("cuadre_id") REFERENCES "cuadres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadre_balance_miembro" ADD CONSTRAINT "cuadre_balance_miembro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

