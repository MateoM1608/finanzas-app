# Finanzas — Backend

API REST en Node.js + Express + Prisma + PostgreSQL. Fase 1: autenticación y onboarding de hogares.

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
- `POST /invitaciones` — genera un código de invitación de un solo uso (vigencia 7 días). Requiere ser admin o tener `puedeInvitar`.
- `POST /join` — `{ codigo }` → une al usuario autenticado al hogar de esa invitación. Falla si el usuario ya tiene hogar, o si el código es inválido/usado/expirado.

## Notas de diseño

- El esquema de Prisma solo incluye las tablas necesarias para esta fase (`usuarios`, `hogares`, `puntos_corte_hogar`, `invitaciones_hogar`); el resto del modelo de datos se agrega incrementalmente en fases posteriores.
- Al crear un hogar se generan puntos de corte por defecto según la frecuencia elegida (ej. quincenal → día 15 y fin de mes); son editables más adelante desde Settings del hogar (Fase 3).
- Todo acceso a datos que dependa del usuario autenticado se filtra a nivel de query por su `id`/`hogarId`, nunca solo en la capa de aplicación.
