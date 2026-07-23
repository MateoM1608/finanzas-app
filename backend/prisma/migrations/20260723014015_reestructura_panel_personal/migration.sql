-- CreateEnum
CREATE TYPE "ModoFijoPersonal" AS ENUM ('automatico', 'manual');

-- CreateEnum
CREATE TYPE "EstadoPagoPersonal" AS ENUM ('pagado', 'pendiente');

-- CreateEnum
CREATE TYPE "EstadoIngresoPersonal" AS ENUM ('recibido', 'pendiente');

-- CreateEnum
CREATE TYPE "AplicaCategoriaPersonal" AS ENUM ('gasto', 'ingreso', 'ahorro');

-- DropForeignKey
ALTER TABLE "concepto_puntos_corte_personal" DROP CONSTRAINT "concepto_puntos_corte_personal_concepto_id_fkey";

-- DropForeignKey
ALTER TABLE "concepto_puntos_corte_personal" DROP CONSTRAINT "concepto_puntos_corte_personal_punto_corte_id_fkey";

-- DropForeignKey
ALTER TABLE "conceptos_recurrentes_personal" DROP CONSTRAINT "conceptos_recurrentes_personal_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "corte_items_personal" DROP CONSTRAINT "corte_items_personal_corte_personal_id_fkey";

-- DropForeignKey
ALTER TABLE "corte_items_personal" DROP CONSTRAINT "corte_items_personal_instancia_id_fkey";

-- DropForeignKey
ALTER TABLE "cortes_personal" DROP CONSTRAINT "cortes_personal_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "gastos_recurrentes_personal_instancia" DROP CONSTRAINT "gastos_recurrentes_personal_instancia_concepto_id_fkey";

-- DropForeignKey
ALTER TABLE "gastos_recurrentes_personal_instancia" DROP CONSTRAINT "gastos_recurrentes_personal_instancia_punto_corte_id_fkey";

-- DropForeignKey
ALTER TABLE "puntos_corte_personal" DROP CONSTRAINT "puntos_corte_personal_usuario_id_fkey";

-- AlterTable
ALTER TABLE "gastos_personales" DROP COLUMN "categoria",
DROP COLUMN "tipo",
ADD COLUMN     "categoria_id" TEXT,
ADD COLUMN     "es_obligatorio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estado" "EstadoPagoPersonal" NOT NULL DEFAULT 'pagado',
ADD COLUMN     "metodo_pago_id" TEXT,
ADD COLUMN     "origen_config_id" TEXT;

-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "frecuencia_corte_personal";

-- DropTable
DROP TABLE "concepto_puntos_corte_personal";

-- DropTable
DROP TABLE "conceptos_recurrentes_personal";

-- DropTable
DROP TABLE "corte_items_personal";

-- DropTable
DROP TABLE "cortes_personal";

-- DropTable
DROP TABLE "gastos_recurrentes_personal_instancia";

-- DropTable
DROP TABLE "puntos_corte_personal";

-- DropEnum
DROP TYPE "TipoGastoPersonal";

-- CreateTable
CREATE TABLE "metodos_pago_personales" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "metodos_pago_personales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_personales" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "aplica_a" "AplicaCategoriaPersonal"[],

    CONSTRAINT "categorias_personales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_fijos_config" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "frecuencia" "FrecuenciaCorte" NOT NULL,
    "modo_cobro" "ModoFijoPersonal" NOT NULL,
    "es_obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "metodo_pago_id_default" TEXT,
    "categoria_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_fijos_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingresos_fijos_config" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "frecuencia" "FrecuenciaCorte" NOT NULL,
    "modo" "ModoFijoPersonal" NOT NULL,
    "categoria_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingresos_fijos_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingresos_personales" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "origen_config_id" TEXT,
    "monto" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoIngresoPersonal" NOT NULL DEFAULT 'recibido',
    "metodo_pago_id" TEXT,
    "categoria_id" TEXT,
    "origen" "OrigenGasto" NOT NULL DEFAULT 'app',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingresos_personales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metodos_pago_personales_usuario_id_idx" ON "metodos_pago_personales"("usuario_id");

-- CreateIndex
CREATE INDEX "categorias_personales_usuario_id_idx" ON "categorias_personales"("usuario_id");

-- CreateIndex
CREATE INDEX "gastos_fijos_config_usuario_id_idx" ON "gastos_fijos_config"("usuario_id");

-- CreateIndex
CREATE INDEX "ingresos_fijos_config_usuario_id_idx" ON "ingresos_fijos_config"("usuario_id");

-- CreateIndex
CREATE INDEX "ingresos_personales_usuario_id_idx" ON "ingresos_personales"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_personales_origen_config_id_fecha_key" ON "ingresos_personales"("origen_config_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_origen_config_id_fecha_key" ON "gastos_personales"("origen_config_id", "fecha");

-- AddForeignKey
ALTER TABLE "metodos_pago_personales" ADD CONSTRAINT "metodos_pago_personales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_personales" ADD CONSTRAINT "categorias_personales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_fijos_config" ADD CONSTRAINT "gastos_fijos_config_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_fijos_config" ADD CONSTRAINT "gastos_fijos_config_metodo_pago_id_default_fkey" FOREIGN KEY ("metodo_pago_id_default") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_fijos_config" ADD CONSTRAINT "gastos_fijos_config_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_fijos_config" ADD CONSTRAINT "ingresos_fijos_config_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_fijos_config" ADD CONSTRAINT "ingresos_fijos_config_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_origen_config_id_fkey" FOREIGN KEY ("origen_config_id") REFERENCES "gastos_fijos_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_personales" ADD CONSTRAINT "ingresos_personales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_personales" ADD CONSTRAINT "ingresos_personales_origen_config_id_fkey" FOREIGN KEY ("origen_config_id") REFERENCES "ingresos_fijos_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_personales" ADD CONSTRAINT "ingresos_personales_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_personales" ADD CONSTRAINT "ingresos_personales_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

