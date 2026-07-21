-- CreateEnum
CREATE TYPE "FrecuenciaCorte" AS ENUM ('semanal', 'quincenal', 'mensual');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "hogar_id" TEXT,
    "es_admin" BOOLEAN NOT NULL DEFAULT false,
    "puede_editar_gastos" BOOLEAN NOT NULL DEFAULT false,
    "puede_invitar" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hogares" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "frecuencia_corte" "FrecuenciaCorte" NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hogares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puntos_corte_hogar" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "referencia" TEXT NOT NULL,

    CONSTRAINT "puntos_corte_hogar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitaciones_hogar" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "creado_por_usuario_id" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitaciones_hogar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- CreateIndex
CREATE INDEX "usuarios_hogar_id_idx" ON "usuarios"("hogar_id");

-- CreateIndex
CREATE INDEX "puntos_corte_hogar_hogar_id_idx" ON "puntos_corte_hogar"("hogar_id");

-- CreateIndex
CREATE UNIQUE INDEX "puntos_corte_hogar_hogar_id_orden_key" ON "puntos_corte_hogar"("hogar_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "invitaciones_hogar_codigo_key" ON "invitaciones_hogar"("codigo");

-- CreateIndex
CREATE INDEX "invitaciones_hogar_hogar_id_idx" ON "invitaciones_hogar"("hogar_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puntos_corte_hogar" ADD CONSTRAINT "puntos_corte_hogar_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones_hogar" ADD CONSTRAINT "invitaciones_hogar_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones_hogar" ADD CONSTRAINT "invitaciones_hogar_creado_por_usuario_id_fkey" FOREIGN KEY ("creado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
