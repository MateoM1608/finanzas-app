# Finanzas — Frontend

Vue 3 + Vite + Tailwind CSS. Fase 2: login, registro, onboarding de hogar y panel personal básico.

## Setup

1. `npm install`
2. Copiar `.env.example` a `.env` y ajustar `VITE_API_URL` si el backend no corre en `http://localhost:3001`
3. `npm run dev` — levanta el servidor de desarrollo en `http://localhost:5173`

Requiere el backend corriendo (ver `../backend/README.md`) — la autenticación usa una cookie httpOnly, así que backend y frontend deben correr en el mismo dominio raíz (en dev, `localhost` en distintos puertos funciona porque comparten "site" para efectos de `SameSite=Lax`).

## Diseño

Paleta oscura minimalista tipo fintech premium: fondo casi negro (`canvas` `#0A0A0B`), tarjetas ligeramente más claras (`surface`), un único color de acento dorado (`accent` `#D4AF37`) para las acciones principales, y verde/rojo (`positive`/`negative`) reservados para semántica financiera. Tipografía Inter. Todo definido en `tailwind.config.js` y las clases base en `src/assets/main.css` (`.card`, `.btn-primary`, `.field`, etc.) para mantener consistencia entre vistas.

## Estructura

- `src/stores/auth.js` — Pinia: usuario autenticado, se hidrata con `GET /api/auth/me` al cargar la app
- `src/router/index.js` — guards: redirige a `/login` si no hay sesión, a `/onboarding` si hay sesión pero no hogar, y de vuelta a `/` si ya tiene hogar
- `src/api/` — clientes por recurso (`auth` vive en el store, `hogares`, `gastosPersonales`)
- `src/views/` — `LoginView`, `RegisterView`, `OnboardingView` (crear/unirse a hogar), `PersonalPanelView` (listar/crear/eliminar gastos personales)

## Pendiente para próximas fases

- Ingreso personal por corte, presupuestos, deudas y metas (fases posteriores)
- Configuración de `try_files`/history fallback en el servidor de producción para el modo `history` de vue-router
