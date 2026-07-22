-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "frecuencia_corte_personal" "FrecuenciaCorte" NOT NULL DEFAULT 'mensual';

-- CreateTable
CREATE TABLE "puntos_corte_personal" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "referencia" TEXT NOT NULL,
    "dia_mes" INTEGER,
    "dia_semana" INTEGER,

    CONSTRAINT "puntos_corte_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conceptos_recurrentes_personal" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "tipo_monto" "TipoMontoConcepto" NOT NULL,
    "monto_default" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conceptos_recurrentes_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepto_puntos_corte_personal" (
    "id" TEXT NOT NULL,
    "concepto_id" TEXT NOT NULL,
    "punto_corte_id" TEXT NOT NULL,

    CONSTRAINT "concepto_puntos_corte_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_recurrentes_personal_instancia" (
    "id" TEXT NOT NULL,
    "concepto_id" TEXT NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "punto_corte_id" TEXT NOT NULL,
    "fecha_nominal" TIMESTAMP(3) NOT NULL,
    "monto" INTEGER,
    "estado" "EstadoGastoPareja" NOT NULL DEFAULT 'pendiente',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_recurrentes_personal_instancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cortes_personal" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fecha_nominal" TIMESTAMP(3) NOT NULL,
    "fecha_ejecucion" TIMESTAMP(3),
    "estado" "EstadoCorte" NOT NULL DEFAULT 'abierto',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cortes_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corte_items_personal" (
    "id" TEXT NOT NULL,
    "corte_personal_id" TEXT NOT NULL,
    "instancia_id" TEXT NOT NULL,
    "incluido" BOOLEAN NOT NULL DEFAULT true,
    "monto" INTEGER,

    CONSTRAINT "corte_items_personal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "puntos_corte_personal_usuario_id_idx" ON "puntos_corte_personal"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "puntos_corte_personal_usuario_id_orden_key" ON "puntos_corte_personal"("usuario_id", "orden");

-- CreateIndex
CREATE INDEX "conceptos_recurrentes_personal_usuario_id_idx" ON "conceptos_recurrentes_personal"("usuario_id");

-- CreateIndex
CREATE INDEX "concepto_puntos_corte_personal_concepto_id_idx" ON "concepto_puntos_corte_personal"("concepto_id");

-- CreateIndex
CREATE UNIQUE INDEX "concepto_puntos_corte_personal_concepto_id_punto_corte_id_key" ON "concepto_puntos_corte_personal"("concepto_id", "punto_corte_id");

-- CreateIndex
CREATE INDEX "gastos_recurrentes_personal_instancia_punto_corte_id_idx" ON "gastos_recurrentes_personal_instancia"("punto_corte_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_recurrentes_personal_instancia_concepto_id_periodo_i_key" ON "gastos_recurrentes_personal_instancia"("concepto_id", "periodo_inicio", "punto_corte_id");

-- CreateIndex
CREATE INDEX "cortes_personal_usuario_id_idx" ON "cortes_personal"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "cortes_personal_usuario_id_fecha_nominal_key" ON "cortes_personal"("usuario_id", "fecha_nominal");

-- CreateIndex
CREATE INDEX "corte_items_personal_corte_personal_id_idx" ON "corte_items_personal"("corte_personal_id");

-- CreateIndex
CREATE UNIQUE INDEX "corte_items_personal_corte_personal_id_instancia_id_key" ON "corte_items_personal"("corte_personal_id", "instancia_id");

-- AddForeignKey
ALTER TABLE "puntos_corte_personal" ADD CONSTRAINT "puntos_corte_personal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conceptos_recurrentes_personal" ADD CONSTRAINT "conceptos_recurrentes_personal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepto_puntos_corte_personal" ADD CONSTRAINT "concepto_puntos_corte_personal_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "conceptos_recurrentes_personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepto_puntos_corte_personal" ADD CONSTRAINT "concepto_puntos_corte_personal_punto_corte_id_fkey" FOREIGN KEY ("punto_corte_id") REFERENCES "puntos_corte_personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes_personal_instancia" ADD CONSTRAINT "gastos_recurrentes_personal_instancia_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "conceptos_recurrentes_personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes_personal_instancia" ADD CONSTRAINT "gastos_recurrentes_personal_instancia_punto_corte_id_fkey" FOREIGN KEY ("punto_corte_id") REFERENCES "puntos_corte_personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cortes_personal" ADD CONSTRAINT "cortes_personal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corte_items_personal" ADD CONSTRAINT "corte_items_personal_corte_personal_id_fkey" FOREIGN KEY ("corte_personal_id") REFERENCES "cortes_personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corte_items_personal" ADD CONSTRAINT "corte_items_personal_instancia_id_fkey" FOREIGN KEY ("instancia_id") REFERENCES "gastos_recurrentes_personal_instancia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
