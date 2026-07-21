-- CreateEnum
CREATE TYPE "TipoGastoPersonal" AS ENUM ('recurrente', 'puntual');

-- CreateEnum
CREATE TYPE "OrigenGasto" AS ENUM ('app', 'bot');

-- CreateTable
CREATE TABLE "gastos_personales" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "categoria" TEXT,
    "monto" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoGastoPersonal" NOT NULL DEFAULT 'puntual',
    "origen" "OrigenGasto" NOT NULL DEFAULT 'app',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_personales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_personales_usuario_id_idx" ON "gastos_personales"("usuario_id");

-- AddForeignKey
ALTER TABLE "gastos_personales" ADD CONSTRAINT "gastos_personales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
