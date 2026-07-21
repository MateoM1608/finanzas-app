-- CreateEnum
CREATE TYPE "TipoMontoConcepto" AS ENUM ('fijo', 'variable');

-- CreateTable
CREATE TABLE "conceptos_recurrentes_pareja" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "tipo_monto" "TipoMontoConcepto" NOT NULL,
    "monto_default" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conceptos_recurrentes_pareja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepto_puntos_corte" (
    "id" TEXT NOT NULL,
    "concepto_id" TEXT NOT NULL,
    "punto_corte_id" TEXT NOT NULL,

    CONSTRAINT "concepto_puntos_corte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_porcentaje_miembro" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_porcentaje_miembro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_transferencia_admin" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "usuario_anterior_id" TEXT NOT NULL,
    "usuario_nuevo_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_transferencia_admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conceptos_recurrentes_pareja_hogar_id_idx" ON "conceptos_recurrentes_pareja"("hogar_id");

-- CreateIndex
CREATE INDEX "concepto_puntos_corte_concepto_id_idx" ON "concepto_puntos_corte"("concepto_id");

-- CreateIndex
CREATE UNIQUE INDEX "concepto_puntos_corte_concepto_id_punto_corte_id_key" ON "concepto_puntos_corte"("concepto_id", "punto_corte_id");

-- CreateIndex
CREATE INDEX "split_porcentaje_miembro_hogar_id_idx" ON "split_porcentaje_miembro"("hogar_id");

-- CreateIndex
CREATE UNIQUE INDEX "split_porcentaje_miembro_hogar_id_usuario_id_periodo_inicio_key" ON "split_porcentaje_miembro"("hogar_id", "usuario_id", "periodo_inicio");

-- CreateIndex
CREATE INDEX "log_transferencia_admin_hogar_id_idx" ON "log_transferencia_admin"("hogar_id");

-- AddForeignKey
ALTER TABLE "conceptos_recurrentes_pareja" ADD CONSTRAINT "conceptos_recurrentes_pareja_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepto_puntos_corte" ADD CONSTRAINT "concepto_puntos_corte_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "conceptos_recurrentes_pareja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepto_puntos_corte" ADD CONSTRAINT "concepto_puntos_corte_punto_corte_id_fkey" FOREIGN KEY ("punto_corte_id") REFERENCES "puntos_corte_hogar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_porcentaje_miembro" ADD CONSTRAINT "split_porcentaje_miembro_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_porcentaje_miembro" ADD CONSTRAINT "split_porcentaje_miembro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_transferencia_admin" ADD CONSTRAINT "log_transferencia_admin_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_transferencia_admin" ADD CONSTRAINT "log_transferencia_admin_usuario_anterior_id_fkey" FOREIGN KEY ("usuario_anterior_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_transferencia_admin" ADD CONSTRAINT "log_transferencia_admin_usuario_nuevo_id_fkey" FOREIGN KEY ("usuario_nuevo_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
