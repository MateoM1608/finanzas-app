/*
  Warnings:

  - Added the required column `fecha_nominal` to the `gastos_recurrentes_instancia` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoCorte" AS ENUM ('abierto', 'cerrado');

-- CreateEnum
CREATE TYPE "TipoOrigenCorteItem" AS ENUM ('recurrente', 'variable');

-- AlterTable
ALTER TABLE "gastos_recurrentes_instancia" ADD COLUMN     "fecha_nominal" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "cortes" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "fecha_nominal" TIMESTAMP(3) NOT NULL,
    "fecha_ejecucion" TIMESTAMP(3),
    "estado" "EstadoCorte" NOT NULL DEFAULT 'abierto',
    "creado_por_usuario_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cortes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corte_items" (
    "id" TEXT NOT NULL,
    "corte_id" TEXT NOT NULL,
    "tipo_origen" "TipoOrigenCorteItem" NOT NULL,
    "origen_id" TEXT NOT NULL,
    "incluido" BOOLEAN NOT NULL DEFAULT true,
    "monto" INTEGER NOT NULL,

    CONSTRAINT "corte_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corte_balance_miembro" (
    "id" TEXT NOT NULL,
    "corte_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,

    CONSTRAINT "corte_balance_miembro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cortes_hogar_id_idx" ON "cortes"("hogar_id");

-- CreateIndex
CREATE UNIQUE INDEX "cortes_hogar_id_fecha_nominal_key" ON "cortes"("hogar_id", "fecha_nominal");

-- CreateIndex
CREATE INDEX "corte_items_corte_id_idx" ON "corte_items"("corte_id");

-- CreateIndex
CREATE UNIQUE INDEX "corte_items_corte_id_tipo_origen_origen_id_key" ON "corte_items"("corte_id", "tipo_origen", "origen_id");

-- CreateIndex
CREATE INDEX "corte_balance_miembro_corte_id_idx" ON "corte_balance_miembro"("corte_id");

-- CreateIndex
CREATE UNIQUE INDEX "corte_balance_miembro_corte_id_usuario_id_key" ON "corte_balance_miembro"("corte_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "cortes" ADD CONSTRAINT "cortes_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cortes" ADD CONSTRAINT "cortes_creado_por_usuario_id_fkey" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corte_items" ADD CONSTRAINT "corte_items_corte_id_fkey" FOREIGN KEY ("corte_id") REFERENCES "cortes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corte_balance_miembro" ADD CONSTRAINT "corte_balance_miembro_corte_id_fkey" FOREIGN KEY ("corte_id") REFERENCES "cortes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corte_balance_miembro" ADD CONSTRAINT "corte_balance_miembro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "split_porcentaje_miembro_hogar_id_usuario_id_periodo_inici_key" RENAME TO "split_porcentaje_miembro_hogar_id_usuario_id_periodo_inicio_key";
