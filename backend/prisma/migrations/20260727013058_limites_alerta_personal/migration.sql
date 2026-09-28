-- CreateEnum
CREATE TYPE "TipoObjetivoLimite" AS ENUM ('categoria', 'obligatorios', 'no_obligatorios', 'todo_gasto');

-- CreateEnum
CREATE TYPE "EstadoLimite" AS ENUM ('dentro', 'excedido');

-- CreateTable
CREATE TABLE "limites_alerta_personal" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_objetivo" "TipoObjetivoLimite" NOT NULL,
    "categoria_id" TEXT,
    "regla_tipo" "ReglaAhorroTipo" NOT NULL,
    "regla_valor" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "limites_alerta_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limites_evaluados_periodo" (
    "id" TEXT NOT NULL,
    "limite_id" TEXT NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fin" TIMESTAMP(3) NOT NULL,
    "regla_valor_usado" INTEGER NOT NULL,
    "limite_calculado" INTEGER NOT NULL,
    "monto_gastado" INTEGER NOT NULL,
    "disponible_restante" INTEGER NOT NULL,
    "estado" "EstadoLimite" NOT NULL,
    "evaluado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "limites_evaluados_periodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "limites_alerta_personal_usuario_id_idx" ON "limites_alerta_personal"("usuario_id");

-- CreateIndex
CREATE INDEX "limites_evaluados_periodo_limite_id_idx" ON "limites_evaluados_periodo"("limite_id");

-- CreateIndex
CREATE UNIQUE INDEX "limites_evaluados_periodo_limite_id_periodo_inicio_key" ON "limites_evaluados_periodo"("limite_id", "periodo_inicio");

-- AddForeignKey
ALTER TABLE "limites_alerta_personal" ADD CONSTRAINT "limites_alerta_personal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limites_alerta_personal" ADD CONSTRAINT "limites_alerta_personal_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limites_evaluados_periodo" ADD CONSTRAINT "limites_evaluados_periodo_limite_id_fkey" FOREIGN KEY ("limite_id") REFERENCES "limites_alerta_personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

