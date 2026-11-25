-- DropForeignKey
ALTER TABLE "dispositivos_notificacion" DROP CONSTRAINT "dispositivos_notificacion_metodoPagoPersonalId_fkey";

-- DropForeignKey
ALTER TABLE "notificaciones" DROP CONSTRAINT "notificaciones_metodoPagoPersonalId_fkey";

-- AlterTable
ALTER TABLE "dispositivos_notificacion" DROP COLUMN "metodoPagoPersonalId";

-- AlterTable
ALTER TABLE "gastos_personales" ADD COLUMN     "registrado_por_id" TEXT;

-- AlterTable
ALTER TABLE "gastos_recurrentes_instancia" ADD COLUMN     "pago_registrado_por_id" TEXT;

-- AlterTable
ALTER TABLE "gastos_variables_pareja" ADD COLUMN     "registrado_por_id" TEXT;

-- AlterTable
ALTER TABLE "notificaciones" DROP COLUMN "metodoPagoPersonalId";

-- CreateTable
CREATE TABLE "actividad_hogar" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" INTEGER,
    "enlace" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actividad_hogar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "actividad_hogar_hogar_id_creado_en_idx" ON "actividad_hogar"("hogar_id", "creado_en");

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_hogar" ADD CONSTRAINT "actividad_hogar_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_hogar" ADD CONSTRAINT "actividad_hogar_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

