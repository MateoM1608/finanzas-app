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

- *Gastos recurrentes*: catálogo configurable por hogar, cada concepto es `tipo_monto` fijo o variable. Frecuencia de corte configurable por hogar (semanal/quincenal/mensual). Si hay más de un punto de corte por ciclo (ej. quincenal = 15 y fin de mes), cada concepto se puede limitar a un punto específico o aplicar a todos (`concepto_puntos_corte`).
- *Gastos variables puntuales*: item, valor, quién pagó, fecha límite, reparto por persona.
- *Cortes (motor central)*: evento periódico de liquidación. Al iniciarlo, se juntan todos los pendientes (recurrentes + variables) con fecha ≤ la fecha nominal del corte, preseleccionados. Se pueden deseleccionar los que no se han pagado en la realidad — esos quedan `pendiente` y pasan solos al siguiente corte. Al confirmar, se calcula el neto final y el corte queda `cerrado`.
- Deudas conjuntas, inversiones conjuntas, metas de ahorro en pareja — mismo patrón que lo personal pero a nivel `hogar_id`.

**Bot de Telegram (vía n8n, no vive en el backend):**

- Login por chat: primera vez pide usuario/contraseña, valida contra `POST /api/n8n/login`, guarda `chat_id ↔ usuario_id` para siempre.
- Puede registrar gastos/ingresos personales o de pareja según el lenguaje del mensaje; si es ambiguo, pregunta antes de registrar (nunca asume que algo es de pareja).
- Agente con tool calling (Claude/Sonnet) contra la API interna: consulta datos reales antes de dar consejos.
- Recordatorios de vencimiento y resúmenes bajo demanda (opt-in por usuario, frecuencia configurable).
- Endpoints protegidos con `SERVICE_TOKEN` (no con el login normal de usuario).

## Modelo de datos

Ver detalle completo en `Especificacion_App_Finanzas_Pareja.md` (sección 4) en este mismo repo — inclúyelo como referencia si necesitas el esquema completo de tablas.

## Plan de fases (estamos empezando la Fase 1)

1. Backend (API) + esquema de base de datos + autenticación + onboarding (crear/unirse a hogar)
2. Frontend web (Vue 3): login, panel personal básico
3. Settings del hogar: frecuencia de corte, conceptos configurables, invitar miembros, % split, permisos
4. Panel de pareja: gastos recurrentes + variables puntuales
5. Motor de cortes
6. Dashboard con gráficos
7. API para n8n + workflows: login por chat, registro de gastos, recordatorios
8. Workflow de resúmenes bajo demanda
9. Deudas, metas de ahorro, inversiones, exportar datos
10. Empaquetado móvil (Capacitor + Ionic Vue)

## Convenciones de trabajo

- No asumas que "hogar" siempre son exactamente 2 personas — el modelo debe soportar N miembros aunque hoy solo se use con 2.
- Todo dato personal debe quedar estrictamente scopeado por `usuario_id` a nivel de query — nunca filtrar a nivel de aplicación solamente.
- Moneda: pesos colombianos (COP), sin decimales.
- Antes de escribir código de una fase nueva, resume tu plan y espera confirmación.

