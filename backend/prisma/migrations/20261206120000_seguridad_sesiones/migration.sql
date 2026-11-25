-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "sesion_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "intentos_acceso" (
    "clave" TEXT NOT NULL,
    "conteo" INTEGER NOT NULL DEFAULT 0,
    "ventana_inicio" TIMESTAMP(3) NOT NULL,
    "bloqueado_hasta" TIMESTAMP(3),

    CONSTRAINT "intentos_acceso_pkey" PRIMARY KEY ("clave")
);

