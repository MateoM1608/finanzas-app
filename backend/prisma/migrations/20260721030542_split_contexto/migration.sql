-- CreateEnum
CREATE TYPE "SplitContexto" AS ENUM ('general', 'gastos_variables');

-- AlterTable
ALTER TABLE "split_porcentaje_miembro" ADD COLUMN "contexto" "SplitContexto" NOT NULL DEFAULT 'general';

-- DropIndex
DROP INDEX "split_porcentaje_miembro_hogar_id_usuario_id_periodo_inicio_key";

-- CreateIndex
CREATE UNIQUE INDEX "split_porcentaje_miembro_hogar_id_usuario_id_periodo_inici_key" ON "split_porcentaje_miembro"("hogar_id", "usuario_id", "periodo_inicio", "contexto");
