# App de Finanzas

## Qué es esto

App web (con APK futuro) para manejar finanzas personales y de pareja: panel privado por usuario + panel de hogar compartido, con liquidación periódica por "cortes" y un bot de Telegram (vía n8n) para registrar gastos y pedir asesoría con IA.

## Stack

- **Backend:** Node.js + Express + Prisma + PostgreSQL — API REST pura, sin frontend embebido
- **Frontend web:** Vue 3 + Vite, responsive/mobile-first (el APK con Capacitor + Ionic Vue viene en una fase posterior, reutilizando este mismo código)
- **Auth:** JWT o cookie de sesión de larga duración (~1 año, sin expiración corta) + bcrypt
- **Automatización:** n8n (ya instalado en el VPS, servicio aparte) — bot de Telegram con IA (Claude, vía tool calling) para registrar gastos/ingresos y responder preguntas de asesoría usando datos reales
- **Infraestructura:** VPS Hostinger + EasyPanel (Docker). Deploy vía repos de GitHub conectados a servicios de EasyPanel (backend, frontend, Postgres son servicios separados)

## Reglas de negocio clave

**Hogares multi-usuario:** al registrarse, si el usuario no tiene hogar, elige crear uno o unirse con código de invitación. Permisos por miembro, independientes entre sí: `puede_editar_gastos` y `puede_invitar`. Rol de admin/creador transferible (uno activo a la vez).

**Panel personal (privado, aislado):** gastos puntuales, ingreso por corte (modo automático con monto default, o manual), presupuesto, deudas personales, metas de ahorro. Nada de esto es visible para el otro miembro del hogar ni se expone a consultas de pareja.

**Panel de pareja:**

- *Gastos recurrentes*: catálogo configurable por hogar, cada concepto es `tipo_monto` fijo o variable. Frecuencia de corte configurable por hogar (semanal/quincenal/mensual). Si hay más de un punto de corte por ciclo (ej. quincenal = 15 y fin de mes), cada concepto se puede limitar a un punto específico o aplicar a todos (`concepto_puntos_corte`). Se configuran en Settings, pero su instancia por período (monto si es variable, pagador) se completa en el propio corte — Panel del hogar solo los muestra en modo lectura.
- *Gastos variables puntuales*: item, valor, quién pagó, fecha límite, reparto por persona. Se crean desde Panel del hogar.
- *Cortes (motor central)*: evento periódico de liquidación. Al iniciarlo, se aseguran las instancias recurrentes del punto de atraso más reciente (si hay) y del período actual, y se juntan todos los pendientes (recurrentes + variables) con fecha ≤ la fecha nominal del corte, preseleccionados — agrupados en pantalla como "Gastos recurrentes" / "Gastos variables". Se pueden deseleccionar los que no se han pagado en la realidad — esos quedan `pendiente` y pasan solos al siguiente corte. Un corte ya abierto se refresca (no queda pegado) cada vez que se vuelve a consultar, por si aparecen pendientes nuevos. Confirmar exige que todo ítem incluido tenga monto y pagador definidos; al confirmar se calcula el neto final y el corte queda `cerrado`.
- Deudas conjuntas, inversiones conjuntas, metas de ahorro en pareja — mismo patrón que lo personal pero a nivel `hogar_id`.

**Bot de Telegram (vía n8n, no vive en el backend):**

- Login por chat: primera vez pide usuario/contraseña, valida contra `POST /api/n8n/login`, guarda `chat_id ↔ usuario_id` para siempre.
- Puede registrar gastos/ingresos personales o de pareja según el lenguaje del mensaje; si es ambiguo, pregunta antes de registrar (nunca asume que algo es de pareja).
- Agente con tool calling (Claude/Sonnet) contra la API interna: consulta datos reales antes de dar consejos.
- Recordatorios de vencimiento y resúmenes bajo demanda (opt-in por usuario, frecuencia configurable).
- Endpoints protegidos con `SERVICE_TOKEN` (no con el login normal de usuario).

## Modelo de datos

Ver detalle completo en `Especificacion_App_Finanzas_Pareja.md` (sección 4) en este mismo repo — inclúyelo como referencia si necesitas el esquema completo de tablas.

## Plan de fases (Fases 1-5 completas y estabilizadas, en curso la Fase 6)

1. ✅ Backend (API) + esquema de base de datos + autenticación + onboarding (crear/unirse a hogar)
2. ✅ Frontend web (Vue 3): login, panel personal básico
3. ✅ Settings del hogar: frecuencia de corte, conceptos configurables, invitar miembros, % split, permisos
4. ✅ Panel del hogar: gastos recurrentes + variables puntuales
5. ✅ Motor de cortes
6. Dashboard con gráficos
7. API para n8n + workflows: login por chat, registro de gastos, recordatorios
8. Workflow de resúmenes bajo demanda
9. Deudas, metas de ahorro, inversiones, exportar datos
10. Empaquetado móvil (Capacitor + Ionic Vue)

## Estado actual (Fases 1-5, estabilizadas)

- **Fase 1 — Auth + onboarding:** registro/login con cookie httpOnly firmada (JWT, ~1 año), bcrypt. Onboarding: crear hogar (define `frecuenciaCorte` y genera sus puntos de corte por defecto) o unirse con código de invitación de un solo uso.
- **Fase 2 — Panel personal:** CRUD de gastos personales, estrictamente scopeados por `usuario_id` a nivel de query. Frontend con diseño claro/fintech (tokens en `tailwind.config.js`, clases base en `frontend/src/assets/main.css`).
- **Fase 3 — Settings del hogar:** miembros y permisos (`puedeEditarGastos`, `puedeInvitar`, transferencia de admin), conceptos recurrentes (crear/editar/desactivar/eliminar con guardas de integridad), split de porcentaje por contexto (`general` y `gastos_variables`, independientes, historizados por período).
- **Fase 4 — Panel del hogar:** gastos recurrentes por período (generación idempotente de instancias, monto y reparto según el concepto, pagador editable con default configurable) + gastos variables puntuales (reparto automático por split vigente o personalizado por gasto, estado visual pendiente/en corte/liquidado).
- **Fase 5 — Motor de cortes:** junta pendientes (recurrentes + variables) primero por atraso acumulado y si no hay, por el período actual en curso; permite deseleccionar ítems no pagados en la realidad (vuelven a `pendiente`); al confirmar calcula el balance por miembro (`corte_balance_miembro`, soporta N miembros) y cierra el corte. Historial expandible con detalle de ítems liquidados y pospuestos, más un resumen fijo por corte (total recurrentes, total variables, cuánto pagó cada miembro, ajuste neto).
- **Estabilización post-Fase 5 (antes de arrancar Fase 6):** las instancias de gastos recurrentes ya no dependen de que alguien visite Panel del hogar — se generan al iniciar/consultar un corte, solo para el punto de atraso más reciente + el período actual (nunca una ventana de varios ciclos, eso causaba instancias duplicadas de un mismo concepto). Panel del hogar dejó de editar recurrentes (quedó un modal de solo lectura); su monto/pagador se define en el propio corte. `CorteItem.monto` es nullable — un ítem puede entrar al corte sin precio, pero `confirmarCorte` exige monto y pagador en todo ítem incluido antes de cerrar. Un corte `abierto` se refresca con pendientes nuevos en cada visita en vez de quedar pegado con lo que tenía al crearse.

Detalle de endpoints y decisiones de diseño de cada fase: `backend/README.md` y `frontend/README.md` (mantenidos al día en cada fase).

## Mejoras técnicas pendientes (backlog antes/durante la Fase 6)

- **N+1 en el motor de cortes:** `enriquecerCorte` y `confirmarCorte` (`backend/src/modules/cortes/cortes.service.js`) resuelven el origen de cada `CorteItem` con una query individual dentro de un loop (`obtenerOrigenDetallado`/`obtenerOrigen`). Funciona bien con pocos ítems por corte, pero no escala — reemplazar por un fetch por lotes (`findMany` con `id: { in: [...] }`, agrupado por `tipoOrigen`) antes de que el volumen de conceptos/gastos por hogar crezca.
- **Índices de base de datos:** revisar que los campos usados en filtros frecuentes de `iniciarCorte`/`buscarPendientes` (`hogarId`, `estado`, `fechaNominal`, `fechaLimite`) tengan índice explícito en `prisma/schema.prisma`, no solo los que Prisma crea automáticamente por relaciones/unique constraints.
- **Refactor de componentes visuales del hogar:** `PanelRecurrentesSection.vue`, `PanelVariablesSection.vue` y `CortesView.vue` repiten la misma lógica de formateo de reparto (`nombre monto · nombre monto`) y de badges/estado por su lado — extraer a un composable/componente compartido (`frontend/src/components/hogar/`) antes de agregar más vistas que dependan del mismo patrón (ej. dashboard de Fase 6).
- **Cálculo de balances duplicado:** la lógica de `previewBalances` en `CortesView.vue` (balance en vivo del corte abierto) reimplementa en el cliente lo mismo que `confirmarCorte` calcula en el backend — mantenerlos sincronizados a mano es frágil; considerar exponer un endpoint de preview o extraer la función a un util compartible si el dashboard de Fase 6 necesita algo similar.
- **Revisión de diseño visual:** antes de construir el dashboard (Fase 6), revisar consistencia visual entre las vistas ya construidas (Panel personal, Settings, Panel del hogar, Cortes) — quedaron implementadas en momentos distintos y no ha habido una pasada final de pulido UI/UX sobre el conjunto.
- **Ojo con los períodos "fantasma" al construir el dashboard:** las instancias de gastos recurrentes NO se backfillean para todo el histórico calendario — solo existen para los períodos donde alguien realmente inició/consultó un corte (punto de atraso más reciente + período actual, ver `iniciarCorte`). Si el dashboard de Fase 6 muestra series de tiempo o comparativas por período, debe basarse en los `Corte`/`CorteItem` (y gastos personales) que realmente existen, nunca asumir que todo punto de corte calendario tiene datos.

## Notas de la base de datos de desarrollo

`DATABASE_URL` apunta a la única base existente (`finanzas-db` en el VPS) — no hay una base de test separada todavía. Mientras el proyecto esté en desarrollo, esta base se trata como base de desarrollo (se puede resetear/limpiar libremente); una vez haya usuarios reales, habrá que separar una base productiva antes de seguir haciendo este tipo de limpiezas directas. Al cierre de la Fase 5 la base fue reseteada por completo (`prisma migrate reset`) — arranca vacía, sin usuarios/hogares de prueba.

## Convenciones de trabajo

- No asumas que "hogar" siempre son exactamente 2 personas — el modelo debe soportar N miembros aunque hoy solo se use con 2.
- Todo dato personal debe quedar estrictamente scopeado por `usuario_id` a nivel de query — nunca filtrar a nivel de aplicación solamente.
- Moneda: pesos colombianos (COP), sin decimales.
- Antes de escribir código de una fase nueva, resume tu plan y espera confirmación.

