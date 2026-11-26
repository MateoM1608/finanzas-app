-- Tarjetas con compras en dólares: valor en US$ (centavos) y tasa en gastos
-- personales y compras a cuotas; parte en dólares del extracto.
ALTER TABLE "gastos_personales" ADD COLUMN "monto_usd" INTEGER;
ALTER TABLE "gastos_personales" ADD COLUMN "capital_usd" INTEGER;
ALTER TABLE "gastos_personales" ADD COLUMN "trm" DOUBLE PRECISION;

ALTER TABLE "compras_cuotas_personales" ADD COLUMN "monto_usd" INTEGER;
ALTER TABLE "compras_cuotas_personales" ADD COLUMN "trm" DOUBLE PRECISION;

ALTER TABLE "extractos_tarjeta" ADD COLUMN "total_banco_usd" INTEGER;
ALTER TABLE "extractos_tarjeta" ADD COLUMN "total_esperado_usd" INTEGER;
