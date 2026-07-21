# Finanzas — Backend

API REST en Node.js + Express + Prisma + PostgreSQL. Fase 1: autenticación y onboarding. Fase 2: gastos personales. Fase 3: settings del hogar (miembros, permisos, conceptos recurrentes, split).

## Setup

1. `npm install`
2. Copiar `.env.example` a `.env` y completar `DATABASE_URL` y `JWT_SECRET` (usar un valor largo y aleatorio, por ejemplo `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
3. `npm run prisma:migrate` — aplica las migraciones contra la base de datos configurada
4. `npm run dev` — levanta el servidor con recarga automática en `http://localhost:3000`

## Endpoints (Fase 1)

### Auth (`/api/auth`)
- `POST /register` — `{ nombre, usuario, password }` → crea el usuario y setea la cookie de sesión
- `POST /login` — `{ usuario, password }`
- `POST /logout`
- `GET /me` — requiere sesión activa

La sesión se maneja con una cookie httpOnly (`finanzas_session`) firmada con JWT, con vigencia de ~1 año.

### Hogares (`/api/hogares`) — requieren sesión activa
- `POST /` — `{ nombre, frecuenciaCorte: "semanal" | "quincenal" | "mensual" }` → crea el hogar, el creador queda como admin con todos los permisos. Falla si el usuario ya pertenece a un hogar.
- `GET /actual` — hogar del usuario autenticado + sus puntos de corte
- `PATCH /` — `{ nombre?, frecuenciaCorte? }`. Requiere admin o `puedeEditarGastos`. Si cambia la frecuencia, reemplaza los puntos de corte por los del nuevo ciclo (y borra las asignaciones de conceptos a esos puntos).
- `PUT /puntos-corte` — `{ puntos: [{ id, referencia }] }` → renombra los puntos de corte existentes (no cambia cuántos hay). Requiere admin o `puedeEditarGastos`.
- `POST /invitaciones` — genera un código de invitación de un solo uso (vigencia 7 días). Requiere ser admin o tener `puedeInvitar`.
- `POST /join` — `{ codigo }` → une al usuario autenticado al hogar de esa invitación. Falla si el usuario ya tiene hogar, o si el código es inválido/usado/expirado.
- `GET /miembros` — lista los miembros del hogar con sus permisos
- `PATCH /miembros/:id/permisos` — `{ puedeEditarGastos?, puedeInvitar? }`. Solo admin.
- `POST /transferir-admin` — `{ nuevoAdminId }`. Solo admin; mueve el rol a otro miembro del hogar y registra el cambio en `log_transferencia_admin`.

### Conceptos recurrentes (`/api/conceptos-recurrentes`) — requieren sesión activa
- `GET /` — lista los conceptos del hogar con sus puntos de corte asignados
- `POST /` — `{ nombre, tipoMonto: "fijo" | "variable", montoDefault? }` (requerido si `tipoMonto` es `fijo`). Requiere admin o `puedeEditarGastos`.
- `PATCH /:id` — editar nombre/activo/tipoMonto/montoDefault. Requiere admin o `puedeEditarGastos`.
- `PUT /:id/puntos-corte` — `{ puntoCorteIds: [] }` → a qué puntos de corte aplica; array vacío = aplica a todos. Requiere admin o `puedeEditarGastos`.

### Split de porcentaje (`/api/split-porcentaje`) — requieren sesión activa
- `GET /` — split vigente (el más reciente con `periodoInicio` ≤ hoy)
- `PUT /` — `{ splits: [{ usuarioId, porcentaje }] }` → los porcentajes deben sumar 100% entre todos los miembros del hogar (soporta N miembros, no solo 2). Cada actualización crea un nuevo período con fecha de hoy, preservando el historial. Requiere admin o `puedeEditarGastos`.

## Notas de diseño

- El esquema de Prisma solo incluye las tablas necesarias hasta la fase actual; el resto del modelo de datos se agrega incrementalmente en fases posteriores.
- Al crear un hogar se generan puntos de corte por defecto según la frecuencia elegida (ej. quincenal → día 15 y fin de mes); editables desde Settings del hogar.
- El split de porcentaje se modela como una fila por miembro (`SplitPorcentajeMiembro`), no como columnas fijas `usuario1`/`usuario2` — el modelo de datos soporta hogares de N personas, no solo parejas.
- Todo acceso a datos que dependa del usuario autenticado se filtra a nivel de query por su `id`/`hogarId`, nunca solo en la capa de aplicación.
