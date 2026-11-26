-- Cuentas fijas del hogar con pago automático: cada cuota se da por pagada
-- en su fecha por el responsable (con su método, opcional).
ALTER TABLE "conceptos_recurrentes_pareja" ADD COLUMN "pago_automatico" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conceptos_recurrentes_pareja" ADD COLUMN "pago_automatico_desde" TIMESTAMP(3);
ALTER TABLE "conceptos_recurrentes_pareja" ADD COLUMN "metodo_pago_automatico_id" TEXT;

ALTER TABLE "gastos_recurrentes_instancia" ADD COLUMN "pago_automatico" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gastos_recurrentes_instancia" ADD COLUMN "sin_pago_automatico" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "conceptos_recurrentes_pareja" ADD CONSTRAINT "conceptos_recurrentes_pareja_metodo_pago_automatico_id_fkey" FOREIGN KEY ("metodo_pago_automatico_id") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
