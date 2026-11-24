-- CreateEnum
CREATE TYPE "SistemaInteres" AS ENUM ('capital_fijo', 'cuota_fija');

-- AlterTable
ALTER TABLE "gastos_personales" ADD COLUMN     "capital" INTEGER,
ADD COLUMN     "interes" INTEGER;

-- AlterTable
ALTER TABLE "gastos_variables_pareja" ADD COLUMN     "capital" INTEGER,
ADD COLUMN     "interes" INTEGER;

-- AlterTable
ALTER TABLE "compras_cuotas_personales" ADD COLUMN     "sistema_interes" "SistemaInteres" NOT NULL DEFAULT 'capital_fijo',
ADD COLUMN     "tasa_mensual" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "compras_cuotas_hogar" ADD COLUMN     "sistema_interes" "SistemaInteres" NOT NULL DEFAULT 'capital_fijo',
ADD COLUMN     "tasa_mensual" DOUBLE PRECISION NOT NULL DEFAULT 0;

