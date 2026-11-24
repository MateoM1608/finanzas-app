-- CreateEnum
CREATE TYPE "TipoMetodoPago" AS ENUM ('efectivo', 'debito', 'tarjeta_credito', 'credito_almacen', 'otro');

-- AlterTable
ALTER TABLE "metodos_pago_personales" ADD COLUMN     "cupo" INTEGER,
ADD COLUMN     "dia_corte" INTEGER,
ADD COLUMN     "dia_pago" INTEGER,
ADD COLUMN     "tipo" "TipoMetodoPago" NOT NULL DEFAULT 'otro',
ADD COLUMN     "ultimos_4" TEXT;

-- AlterTable
ALTER TABLE "gastos_personales" ADD COLUMN     "compra_id" TEXT,
ADD COLUMN     "numero_cuota" INTEGER;

-- AlterTable
ALTER TABLE "gastos_variables_pareja" ADD COLUMN     "compra_id" TEXT,
ADD COLUMN     "fecha_pago" TIMESTAMP(3),
ADD COLUMN     "numero_cuota" INTEGER;

-- CreateTable
CREATE TABLE "compras_cuotas_personales" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto_total" INTEGER NOT NULL,
    "numero_cuotas" INTEGER NOT NULL,
    "fecha_primera_cuota" TIMESTAMP(3) NOT NULL,
    "modo_cobro" "ModoFijoPersonal" NOT NULL,
    "metodo_pago_id" TEXT,
    "categoria_id" TEXT,
    "es_obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_cuotas_personales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_cuotas_hogar" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "monto_total" INTEGER NOT NULL,
    "numero_cuotas" INTEGER NOT NULL,
    "fecha_compra" TIMESTAMP(3) NOT NULL,
    "fecha_primera_cuota" TIMESTAMP(3) NOT NULL,
    "modo_cobro" "ModoFijoPersonal" NOT NULL,
    "pago_usuario_id" TEXT NOT NULL,
    "metodo_pago_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_cuotas_hogar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compras_cuotas_personales_usuario_id_idx" ON "compras_cuotas_personales"("usuario_id");

-- CreateIndex
CREATE INDEX "compras_cuotas_hogar_hogar_id_idx" ON "compras_cuotas_hogar"("hogar_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_personales_compra_id_numero_cuota_key" ON "gastos_personales"("compra_id", "numero_cuota");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_variables_pareja_compra_id_numero_cuota_key" ON "gastos_variables_pareja"("compra_id", "numero_cuota");

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras_cuotas_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_variables_pareja" ADD CONSTRAINT "gastos_variables_pareja_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras_cuotas_hogar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_cuotas_personales" ADD CONSTRAINT "compras_cuotas_personales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_cuotas_personales" ADD CONSTRAINT "compras_cuotas_personales_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_cuotas_personales" ADD CONSTRAINT "compras_cuotas_personales_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_cuotas_hogar" ADD CONSTRAINT "compras_cuotas_hogar_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_cuotas_hogar" ADD CONSTRAINT "compras_cuotas_hogar_pago_usuario_id_fkey" FOREIGN KEY ("pago_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_cuotas_hogar" ADD CONSTRAINT "compras_cuotas_hogar_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

