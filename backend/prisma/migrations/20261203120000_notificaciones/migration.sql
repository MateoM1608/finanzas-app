-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT,
    "clave" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "enviada_push_en" TIMESTAMP(3),
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodoPagoPersonalId" TEXT,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_notificacion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL DEFAULT 'android',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodoPagoPersonalId" TEXT,

    CONSTRAINT "dispositivos_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_leida_creada_en_idx" ON "notificaciones"("usuario_id", "leida", "creada_en");

-- CreateIndex
CREATE UNIQUE INDEX "notificaciones_usuario_id_clave_key" ON "notificaciones"("usuario_id", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_notificacion_token_key" ON "dispositivos_notificacion"("token");

-- CreateIndex
CREATE INDEX "dispositivos_notificacion_usuario_id_idx" ON "dispositivos_notificacion"("usuario_id");

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_metodoPagoPersonalId_fkey" FOREIGN KEY ("metodoPagoPersonalId") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_notificacion" ADD CONSTRAINT "dispositivos_notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_notificacion" ADD CONSTRAINT "dispositivos_notificacion_metodoPagoPersonalId_fkey" FOREIGN KEY ("metodoPagoPersonalId") REFERENCES "metodos_pago_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

