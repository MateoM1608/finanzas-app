# Finanzas — Frontend

Vue 3 + Vite + Tailwind CSS. Fase 2: login, registro, onboarding de hogar y panel personal básico. Fase 3: settings del hogar (frecuencia/puntos de corte, miembros y permisos, conceptos recurrentes, split de gastos). Fase 4: panel del hogar (gastos recurrentes del período + gastos variables puntuales, con reparto personalizable por gasto). Fase 5: motor de cortes (revisar pendientes, confirmar, historial con balances).

## Setup

1. `npm install`
2. Copiar `.env.example` a `.env` y ajustar `VITE_API_URL` si el backend no corre en `http://localhost:3001`
3. `npm run dev` — levanta el servidor de desarrollo en `http://localhost:5173`

Requiere el backend corriendo (ver `../backend/README.md`) — la autenticación usa una cookie httpOnly, así que backend y frontend deben correr en el mismo dominio raíz (en dev, `localhost` en distintos puertos funciona porque comparten "site" para efectos de `SameSite=Lax`).

## Diseño

Paleta clara minimalista tipo fintech premium: fondo blanco/gris muy claro (`canvas` `#F7F8FA`), tarjetas blancas con sombra suave (`surface`), un único color de acento azul (`accent` `#2F6FED`) para las acciones principales y enlaces, y verde/rojo (`positive`/`negative`) reservados para semántica financiera. Tipografía Inter. Todo definido en `tailwind.config.js` y las clases base en `src/assets/main.css` (`.card`, `.btn-primary`, `.field`, etc.) para mantener consistencia entre vistas.

## Estructura

- `src/stores/auth.js` — Pinia: usuario autenticado, se hidrata con `GET /api/auth/me` al cargar la app
- `src/router/index.js` — guards: redirige a `/login` si no hay sesión, a `/onboarding` si hay sesión pero no hogar, y de vuelta a `/` si ya tiene hogar
- `src/api/` — clientes por recurso (`auth` vive en el store, `hogares`, `gastosPersonales`, `conceptosRecurrentes`, `splitPorcentaje`, `gastosRecurrentes`, `gastosVariables`, `cortes`)
- `src/views/` — `LoginView`, `RegisterView`, `OnboardingView` (crear/unirse a hogar), `PersonalPanelView` (listar/crear/eliminar gastos personales), `SettingsView` (tabs de configuración del hogar), `PanelHogarView` (gastos recurrentes del período + variables puntuales), `CortesView` (iniciar/revisar/confirmar corte + historial con balances)
- `src/components/settings/` — una sección por tab de Settings: `SettingsHogarSection` (nombre/frecuencia/puntos de corte), `SettingsMiembrosSection` (invitar, permisos, transferir admin), `SettingsConceptosSection` (conceptos recurrentes fijos/variables, pagador por defecto y a qué puntos de corte aplican), `SettingsSplitSection` (split por miembro con pestañas General / Gastos variables puntuales, valida que sume 100%)
- `src/components/hogar/` — `PanelRecurrentesSection` (instancias del período actual, monto editable con guardado al salir del campo, selector de quién pagó) y `PanelVariablesSection` (alta + listado de gastos puntuales; el reparto es automático desde el split vigente por defecto, pero se puede personalizar al crear el gasto o editarlo después con "Editar reparto"). Cada gasto variable muestra su estado (`Pendiente` sin badge, `En corte abierto` o `Liquidado`) — solo los `pendiente` se pueden editar/eliminar; el resto se ve en gris, sin controles, hasta que se desmarquen del corte que los incluye.
- `CortesView` — el historial de cortes cerrados es expandible: al hacer clic en uno se ve el detalle completo de sus ítems (recurrentes y variables), marcando cuáles quedaron liquidados y cuáles se pospusieron al siguiente corte (`incluido: false`).

El Panel Personal (gastos privados de un usuario) nunca tiene concepto de reparto ni split — eso es exclusivo del Panel del hogar.

Las acciones de edición en Settings se ocultan/deshabilitan en el frontend según `esAdmin`/`puedeEditarGastos` del usuario, pero el backend es quien realmente aplica el permiso — el frontend solo mejora la UX.

## Pendiente para próximas fases

- Ingreso personal por corte, presupuestos, deudas y metas (fases posteriores)
- Configuración de `try_files`/history fallback en el servidor de producción para el modo `history` de vue-router
