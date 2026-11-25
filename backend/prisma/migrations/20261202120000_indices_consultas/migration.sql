-- CreateIndex
CREATE INDEX "gastos_personales_usuario_id_fecha_idx" ON "gastos_personales"("usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "gastos_personales_metodo_pago_id_idx" ON "gastos_personales"("metodo_pago_id");

-- CreateIndex
CREATE INDEX "gastos_recurrentes_instancia_reparto_usuario_id_idx" ON "gastos_recurrentes_instancia_reparto"("usuario_id");

-- CreateIndex
CREATE INDEX "gastos_variables_pareja_reparto_usuario_id_idx" ON "gastos_variables_pareja_reparto"("usuario_id");

-- CreateIndex
CREATE INDEX "ingresos_personales_usuario_id_fecha_idx" ON "ingresos_personales"("usuario_id", "fecha");

