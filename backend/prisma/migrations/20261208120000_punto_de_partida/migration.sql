-- Punto de partida: saldo inicial de cuentas y deuda inicial de tarjetas
-- (origen saldo_inicial) y compras a cuotas que ya venían en curso.
ALTER TYPE "OrigenGasto" ADD VALUE 'saldo_inicial';

ALTER TABLE "compras_cuotas_personales" ADD COLUMN "cuotas_pagadas_antes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "compras_cuotas_hogar" ADD COLUMN "cuotas_pagadas_antes" INTEGER NOT NULL DEFAULT 0;
