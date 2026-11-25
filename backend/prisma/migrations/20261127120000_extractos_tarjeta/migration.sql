-- CreateEnum
CREATE TYPE "EstadoExtracto" AS ENUM ('pendiente', 'revisado');

-- CreateEnum
CREATE TYPE "TipoAjusteExtracto" AS ENUM ('correccion', 'cargo', 'no_reconocido', 'no_cobrado');

-- CreateEnum
CREATE TYPE "ConceptoCargoExtracto" AS ENUM ('interes', 'mora', 'cuota_manejo', 'seguro', 'comision', 'avance', 'otro');

-- CreateEnum
CREATE TYPE "EstadoReclamo" AS ENUM ('pendiente', 'reversado', 'aceptado');

-- CreateEnum
CREATE TYPE "OrigenAjusteExtracto" AS ENUM ('manual', 'ia');

-- CreateTable
CREATE TABLE "extractos_tarjeta" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "metodo_pago_id" TEXT NOT NULL,
    "fecha_corte" TIMESTAMP(3) NOT NULL,
    "fecha_pago" TIMESTAMP(3),
    "total_banco" INTEGER,
    "estado" "EstadoExtracto" NOT NULL DEFAULT 'pendiente',
    "total_esperado" INTEGER,
    "notas" TEXT,
    "revisado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extractos_tarjeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracto_ajustes" (
    "id" TEXT NOT NULL,
    "extracto_id" TEXT NOT NULL,
    "tipo" "TipoAjusteExtracto" NOT NULL,
    "origen" "OrigenAjusteExtracto" NOT NULL DEFAULT 'manual',
    "gasto_id" TEXT,
    "concepto" "ConceptoCargoExtracto",
    "descripcion" TEXT,
    "monto_antes" INTEGER,
    "monto" INTEGER,
    "fecha" TIMESTAMP(3),
    "estado_reclamo" "EstadoReclamo",
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracto_ajustes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extractos_tarjeta_usuario_id_idx" ON "extractos_tarjeta"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "extractos_tarjeta_metodo_pago_id_fecha_corte_key" ON "extractos_tarjeta"("metodo_pago_id", "fecha_corte");

-- CreateIndex
CREATE INDEX "extracto_ajustes_extracto_id_idx" ON "extracto_ajustes"("extracto_id");

-- CreateIndex
CREATE INDEX "extracto_ajustes_gasto_id_idx" ON "extracto_ajustes"("gasto_id");

-- AddForeignKey
ALTER TABLE "extractos_tarjeta" ADD CONSTRAINT "extractos_tarjeta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extractos_tarjeta" ADD CONSTRAINT "extractos_tarjeta_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago_personales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracto_ajustes" ADD CONSTRAINT "extracto_ajustes_extracto_id_fkey" FOREIGN KEY ("extracto_id") REFERENCES "extractos_tarjeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracto_ajustes" ADD CONSTRAINT "extracto_ajustes_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

