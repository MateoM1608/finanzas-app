-- AlterTable
ALTER TABLE "metodos_pago_personales" ADD COLUMN     "sistema_interes" "SistemaInteres" NOT NULL DEFAULT 'capital_fijo',
ADD COLUMN     "tasa_mensual" DOUBLE PRECISION NOT NULL DEFAULT 0;

