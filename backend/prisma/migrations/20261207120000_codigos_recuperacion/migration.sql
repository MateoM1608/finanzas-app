-- CreateTable
CREATE TABLE "codigos_recuperacion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "usado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigos_recuperacion_usuario_id_idx" ON "codigos_recuperacion"("usuario_id");

-- AddForeignKey
ALTER TABLE "codigos_recuperacion" ADD CONSTRAINT "codigos_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

