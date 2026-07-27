-- CreateEnum
CREATE TYPE "ReglaAhorroTipo" AS ENUM ('porcentaje', 'monto_fijo');

-- CreateEnum
CREATE TYPE "BaseCalculoAhorro" AS ENUM ('ingreso_menos_obligatorios', 'disponible_total');

-- CreateEnum
CREATE TYPE "OrigenAhorroTransaccion" AS ENUM ('manual', 'automatico', 'bot');

-- CreateTable
CREATE TABLE "ahorros_personales" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto_meta_total" INTEGER,
    "regla_tipo" "ReglaAhorroTipo" NOT NULL,
    "regla_valor" INTEGER NOT NULL,
    "base_calculo" "BaseCalculoAhorro" NOT NULL DEFAULT 'ingreso_menos_obligatorios',
    "modo_transaccion" "ModoFijoPersonal" NOT NULL,
    "categoria_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ahorros_personales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ahorro_transacciones" (
    "id" TEXT NOT NULL,
    "ahorro_id" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "origen" "OrigenAhorroTransaccion" NOT NULL DEFAULT 'manual',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ahorro_transacciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_ahorro_evaluados" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fin" TIMESTAMP(3) NOT NULL,
    "ingreso_periodo" INTEGER NOT NULL,
    "gastos_obligatorios_periodo" INTEGER NOT NULL,
    "gastos_no_obligatorios_periodo" INTEGER NOT NULL,
    "base_calculo_ahorro" INTEGER NOT NULL,
    "evaluado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_ahorro_evaluados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ahorro_pronosticos" (
    "id" TEXT NOT NULL,
    "ahorro_id" TEXT NOT NULL,
    "periodo_id" TEXT NOT NULL,
    "monto_sugerido" INTEGER NOT NULL,

    CONSTRAINT "ahorro_pronosticos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ahorros_personales_usuario_id_idx" ON "ahorros_personales"("usuario_id");

-- CreateIndex
CREATE INDEX "ahorro_transacciones_ahorro_id_idx" ON "ahorro_transacciones"("ahorro_id");

-- CreateIndex
CREATE INDEX "periodos_ahorro_evaluados_usuario_id_idx" ON "periodos_ahorro_evaluados"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_ahorro_evaluados_usuario_id_periodo_inicio_key" ON "periodos_ahorro_evaluados"("usuario_id", "periodo_inicio");

-- CreateIndex
CREATE INDEX "ahorro_pronosticos_periodo_id_idx" ON "ahorro_pronosticos"("periodo_id");

-- CreateIndex
CREATE UNIQUE INDEX "ahorro_pronosticos_ahorro_id_periodo_id_key" ON "ahorro_pronosticos"("ahorro_id", "periodo_id");

-- AddForeignKey
ALTER TABLE "ahorros_personales" ADD CONSTRAINT "ahorros_personales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahorros_personales" ADD CONSTRAINT "ahorros_personales_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahorro_transacciones" ADD CONSTRAINT "ahorro_transacciones_ahorro_id_fkey" FOREIGN KEY ("ahorro_id") REFERENCES "ahorros_personales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_ahorro_evaluados" ADD CONSTRAINT "periodos_ahorro_evaluados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahorro_pronosticos" ADD CONSTRAINT "ahorro_pronosticos_ahorro_id_fkey" FOREIGN KEY ("ahorro_id") REFERENCES "ahorros_personales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahorro_pronosticos" ADD CONSTRAINT "ahorro_pronosticos_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_ahorro_evaluados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

