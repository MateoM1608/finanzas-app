# Finanzas — Frontend

Vue 3 + Vite + Tailwind CSS. Fase 2: login, registro, onboarding de hogar y panel personal básico. Fase 3: settings del hogar (frecuencia/puntos de corte, miembros y permisos, conceptos recurrentes, split de gastos). Fase 4: panel del hogar (gastos recurrentes del período + gastos variables puntuales, con reparto personalizable por gasto). Fase 5: motor de cortes (revisar pendientes, confirmar, historial con balances). Fase 6: dashboard con gráficos (Chart.js) como landing tras el login. Fase 7 (en curso): reestructuración del panel personal — catálogos, gastos/ingresos fijos-o-esporádicos con estado pagado/pendiente, dentro de Panel personal (ver `Modulo_Panel_Personal_Ajustes.md`).

## Setup

1. `npm install`
2. Copiar `.env.example` a `.env` y ajustar `VITE_API_URL` si el backend no corre en `http://localhost:3001`
3. `npm run dev` — levanta el servidor de desarrollo en `http://localhost:5173`

Requiere el backend corriendo (ver `../backend/README.md`) — la autenticación usa una cookie httpOnly, así que backend y frontend deben correr en el mismo dominio raíz (en dev, `localhost` en distintos puertos funciona porque comparten "site" para efectos de `SameSite=Lax`).

## Diseño

Paleta clara minimalista tipo fintech premium: fondo blanco/gris muy claro (`canvas` `#F7F8FA`), tarjetas blancas con sombra suave (`surface`), un único color de acento azul (`accent` `#2F6FED`) para las acciones principales y enlaces, y verde/rojo (`positive`/`negative`) reservados para semántica financiera. Tipografía Inter. Todo definido en `tailwind.config.js` y las clases base en `src/assets/main.css` (`.card`, `.btn-primary`, `.field`, etc.) para mantener consistencia entre vistas.

## Estructura

- `src/stores/auth.js` — Pinia: usuario autenticado, se hidrata con `GET /api/auth/me` al cargar la app
- `src/router/index.js` — guards: redirige a `/login` si no hay sesión, a `/onboarding` si hay sesión pero no hogar, y de vuelta a `/` (el dashboard) si ya tiene hogar. El panel personal vive en `/personal`.
- `src/api/` — clientes por recurso (`auth` vive en el store, `hogares`, `gastosPersonales`, `ingresosPersonales`, `metodosPagoPersonales`, `categoriasPersonales`, `gastosFijosConfig`, `ingresosFijosConfig`, `conceptosRecurrentes`, `splitPorcentaje`, `gastosRecurrentes`, `gastosVariables`, `cortes`, `dashboard`)
- `src/views/` — `LoginView`, `RegisterView`, `OnboardingView` (crear/unirse a hogar), `DashboardView` (landing tras login: gráficos personales y de hogar), `PersonalPanelView` (gastos e ingresos personales + botón de configuración, en `/personal`), `SettingsView` (tabs de configuración del hogar), `PanelHogarView` (gastos variables puntuales + botón para ver los recurrentes del período en un modal de solo lectura), `CortesView` (iniciar/revisar/confirmar corte + historial con balances)
- `src/components/AppModal.vue` — modal genérico reutilizable (overlay + tarjeta + botón cerrar), usado para el detalle de recurrentes en Panel del hogar y para el formulario de alta de gastos variables.
- `src/components/settings/` — una sección por tab de Settings: `SettingsHogarSection` (nombre/frecuencia/puntos de corte), `SettingsMiembrosSection` (invitar, permisos, transferir admin), `SettingsConceptosSection` (conceptos recurrentes fijos/variables, pagador por defecto y a qué puntos de corte aplican), `SettingsSplitSection` (split por miembro con pestañas General / Gastos variables puntuales, valida que sume 100%)
- `src/components/hogar/` — `PanelRecurrentesSection` (solo lectura: instancias del período actual con su monto/pagador si ya están definidos, o "Por definir en el corte"; se muestra dentro de un `AppModal` desde Panel del hogar — el monto/pagador de estos conceptos ya no se edita ahí, se define en Cortes) y `PanelVariablesSection` (listado de gastos puntuales en la página, con un botón "Agregar gasto variable" que abre el formulario de alta en un `AppModal`; el reparto es automático desde el split vigente por defecto, pero se puede personalizar al crear el gasto o editarlo después con "Editar reparto"). Cada gasto variable muestra su estado (`Pendiente` sin badge, `En corte abierto` o `Liquidado`) — solo los `pendiente` se pueden editar/eliminar; el resto se ve en gris, sin controles, hasta que se desmarquen del corte que los incluye.
- `CortesView` — el corte abierto se agrupa en dos secciones, **Gastos recurrentes** y **Gastos variables**, cada una con su subtotal (o "Falta definir algún monto" si algún ítem incluido de ese grupo no tiene precio todavía); los conceptos recurrentes de monto variable (`tipoMonto: "variable"`) traen un campo de monto editable ahí mismo (llama `PATCH /api/cortes/:id/items/:itemId`), y cada ítem tiene un selector de pagador (borde rojo si falta). El botón "Confirmar corte" se deshabilita si algún ítem incluido no tiene monto o pagador definido, con un mensaje explícito de qué falta — el balance neteado (recurrentes + variables juntos) solo se calcula sobre lo que ya está completo. El historial de cortes cerrados siempre muestra un resumen (total recurrentes, total variables, cuánto pagó cada miembro y el ajuste neto final) más un "Ver detalle por ítem" expandible con el desglose completo, marcando cuáles quedaron liquidados y cuáles se pospusieron al siguiente corte (`incluido: false`).

El Panel Personal (gastos privados de un usuario) nunca tiene concepto de reparto ni split — eso es exclusivo del Panel del hogar.

Las acciones de edición en Settings se ocultan/deshabilitan en el frontend según `esAdmin`/`puedeEditarGastos` del usuario, pero el backend es quien realmente aplica el permiso — el frontend solo mejora la UX.

- `formatReparto` (`src/utils/format.js`) centraliza el formateo "nombre monto · nombre monto" de un array de repartos, usado por `PanelRecurrentesSection`, `PanelVariablesSection` y `CortesView` — antes cada uno lo reimplementaba por su lado.

## Panel personal reestructurado (Fase 7)

La iteración anterior de esta fase tenía un mini-corte personal (`CortePersonalSection.vue`/`RecurrentesPersonalesSection.vue`) — se eliminó por completo. El modelo nuevo no tiene ningún evento de "cierre": un gasto/ingreso fijo se genera directamente como una fila real, ya en estado `pagado`/`pendiente` según su modo de cobro.

Todo vive dentro de `PersonalPanelView.vue` (sigue sin ser un ítem de navegación aparte):

- La vista misma tiene el formulario y listado de **gastos** e **ingresos** esporádicos (categoría/método de pago como select, checkbox de "es obligatorio" en gastos, selector de estado pagado-o-pendiente/recibido-o-pendiente). Cada fila tiene un botón para alternar el estado (ej. "Marcar pagado" cuando un gasto fijo manual por fin sale de la cuenta) y, si no viene de un concepto fijo (`origenConfigId`), un botón para eliminarla — las de origen fijo no se pueden eliminar desde acá (volverían a generarse la próxima vez que se liste), hay que desactivar el concepto fijo.
- `src/components/personal/ConfiguracionPersonalSection.vue` — se abre en un `AppModal` desde el botón "Configuración personal": pestañas simples (no rutas) para Métodos de pago, Categorías (con checkboxes de a qué aplica: gasto/ingreso/ahorro), Gastos fijos e Ingresos fijos. Cada gasto/ingreso fijo pide `fechaInicio` (ancla su propio calendario, independiente del hogar) y modo automático/manual.

## Dashboard (Fase 6)

`DashboardView.vue` es la landing tras login (`/`). Usa Chart.js vía `vue-chartjs` (registrado una vez en `src/main.js`) y consume `GET /api/dashboard/personal` y `GET /api/dashboard/hogar`:

- **Panel personal**: stat cards de total del mes actual/anterior con variación %, barra de gasto mensual (hasta 6 meses con datos reales) y donut de gasto por categoría sobre esa misma ventana.
- **Panel del hogar**: barra apilada de recurrentes vs. variables por corte cerrado, barra agrupada de balance por miembro a través de los cortes, y tarjetas de cuánto ha pagado cada miembro en total. Si hay un corte `abierto`, muestra un aviso con link a `/cortes`.

Todos los gráficos manejan estado vacío explícito ("Aún no hay gastos…", "Todavía no hay cortes cerrados…") en vez de renderizar un gráfico sin datos — importante porque, como no hay backfill de períodos, un hogar recién creado no tiene ninguna serie todavía.

## Pendiente para próximas fases

- Ingreso personal por corte, presupuestos, deudas y metas (fases posteriores)
- Configuración de `try_files`/history fallback en el servidor de producción para el modo `history` de vue-router
- Backlog técnico de UI que sigue abierto (ver CLAUDE.md): índices de BD, `previewBalances` de `CortesView.vue` sigue reimplementando en el cliente el mismo cálculo que hace `confirmarCorte` en el backend, y falta la pasada de pulido visual general entre vistas.
