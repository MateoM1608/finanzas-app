-- CreateEnum
CREATE TYPE "EstadoGastoPareja" AS ENUM ('pendiente', 'incluido_en_corte', 'liquidado');

-- AlterTable
ALTER TABLE "conceptos_recurrentes_pareja" ADD COLUMN     "pagador_default_usuario_id" TEXT;

-- AlterTable
ALTER TABLE "puntos_corte_hogar" ADD COLUMN     "dia_mes" INTEGER,
ADD COLUMN     "dia_semana" INTEGER;

-- CreateTable
CREATE TABLE "gastos_recurrentes_instancia" (
    "id" TEXT NOT NULL,
    "concepto_id" TEXT NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "punto_corte_id" TEXT NOT NULL,
    "monto" INTEGER,
    "pago_usuario_id" TEXT,
    "estado" "EstadoGastoPareja" NOT NULL DEFAULT 'pendiente',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_recurrentes_instancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_recurrentes_instancia_reparto" (
    "id" TEXT NOT NULL,
    "instancia_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,

    CONSTRAINT "gastos_recurrentes_instancia_reparto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_variables_pareja" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "valor_total" INTEGER NOT NULL,
    "pago_usuario_id" TEXT NOT NULL,
    "fecha_limite" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoGastoPareja" NOT NULL DEFAULT 'pendiente',
    "fecha_pago_real" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_variables_pareja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_variables_pareja_reparto" (
    "id" TEXT NOT NULL,
    "gasto_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,

    CONSTRAINT "gastos_variables_pareja_reparto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_recurrentes_instancia_punto_corte_id_idx" ON "gastos_recurrentes_instancia"("punto_corte_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_recurrentes_instancia_concepto_id_periodo_inicio_pun_key" ON "gastos_recurrentes_instancia"("concepto_id", "periodo_inicio", "punto_corte_id");

-- CreateIndex
CREATE INDEX "gastos_recurrentes_instancia_reparto_instancia_id_idx" ON "gastos_recurrentes_instancia_reparto"("instancia_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_recurrentes_instancia_reparto_instancia_id_usuario_i_key" ON "gastos_recurrentes_instancia_reparto"("instancia_id", "usuario_id");

-- CreateIndex
CREATE INDEX "gastos_variables_pareja_hogar_id_idx" ON "gastos_variables_pareja"("hogar_id");

-- CreateIndex
CREATE INDEX "gastos_variables_pareja_reparto_gasto_id_idx" ON "gastos_variables_pareja_reparto"("gasto_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_variables_pareja_reparto_gasto_id_usuario_id_key" ON "gastos_variables_pareja_reparto"("gasto_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "conceptos_recurrentes_pareja" ADD CONSTRAINT "conceptos_recurrentes_pareja_pagador_default_usuario_id_fkey" FOREIGN KEY ("pagador_default_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes_instancia" ADD CONSTRAINT "gastos_recurrentes_instancia_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "conceptos_recurrentes_pareja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes_instancia" ADD CONSTRAINT "gastos_recurrentes_instancia_punto_corte_id_fkey" FOREIGN KEY ("punto_corte_id") REFERENCES "puntos_corte_hogar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes_instancia" ADD CONSTRAINT "gastos_recurrentes_instancia_pago_usuario_id_fkey" FOREIGN KEY ("pago_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes_instancia_reparto" ADD CONSTRAINT "gastos_recurrentes_instancia_reparto_instancia_id_fkey" FOREIGN KEY ("instancia_id") REFERENCES "gastos_recurrentes_instancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes_instancia_reparto" ADD CONSTRAINT "gastos_recurrentes_instancia_reparto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_variables_pareja" ADD CONSTRAINT "gastos_variables_pareja_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_variables_pareja" ADD CONSTRAINT "gastos_variables_pareja_pago_usuario_id_fkey" FOREIGN KEY ("pago_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_variables_pareja_reparto" ADD CONSTRAINT "gastos_variables_pareja_reparto_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos_variables_pareja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_variables_pareja_reparto" ADD CONSTRAINT "gastos_variables_pareja_reparto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
