-- AlterTable
ALTER TABLE "compras_cuotas_hogar" ADD COLUMN     "categoria_id" TEXT;

-- AlterTable
ALTER TABLE "conceptos_recurrentes_pareja" ADD COLUMN     "categoria_id" TEXT;

-- AlterTable
ALTER TABLE "gastos_variables_pareja" ADD COLUMN     "categoria_id" TEXT;

-- CreateTable
CREATE TABLE "categorias_hogar" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_hogar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topes_hogar" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "categoria_id" TEXT,
    "monto_mensual" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topes_hogar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topes_hogar_mes" (
    "id" TEXT NOT NULL,
    "tope_id" TEXT NOT NULL,
    "mes" TIMESTAMP(3) NOT NULL,
    "monto_tope" INTEGER NOT NULL,
    "monto_gastado" INTEGER NOT NULL,
    "evaluado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topes_hogar_mes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_hogar_hogar_id_nombre_key" ON "categorias_hogar"("hogar_id", "nombre");

-- CreateIndex
CREATE INDEX "topes_hogar_hogar_id_idx" ON "topes_hogar"("hogar_id");

-- CreateIndex
CREATE UNIQUE INDEX "topes_hogar_mes_tope_id_mes_key" ON "topes_hogar_mes"("tope_id", "mes");

-- AddForeignKey
ALTER TABLE "conceptos_recurrentes_pareja" ADD CONSTRAINT "conceptos_recurrentes_pareja_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_hogar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_variables_pareja" ADD CONSTRAINT "gastos_variables_pareja_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_hogar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_cuotas_hogar" ADD CONSTRAINT "compras_cuotas_hogar_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_hogar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_hogar" ADD CONSTRAINT "categorias_hogar_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topes_hogar" ADD CONSTRAINT "topes_hogar_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topes_hogar" ADD CONSTRAINT "topes_hogar_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_hogar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topes_hogar_mes" ADD CONSTRAINT "topes_hogar_mes_tope_id_fkey" FOREIGN KEY ("tope_id") REFERENCES "topes_hogar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

