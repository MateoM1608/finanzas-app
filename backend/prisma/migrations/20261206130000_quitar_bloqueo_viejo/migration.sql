-- Columnas del bloqueo viejo por usuario: sin uso desde la tanda de seguridad
-- (el bloqueo pasó a intentos_acceso, por usuario + conexión).
ALTER TABLE "usuarios" DROP COLUMN "bloqueado_hasta",
DROP COLUMN "intentos_fallidos";
