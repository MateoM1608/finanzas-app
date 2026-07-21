# Especificación de la App de Finanzas — Mateo & Daniela

> Estado: **Borrador para revisión.** Nada de esto se ha construido todavía.

---

## 1. Lo que ya hacen hoy (referencia: `Gastos_mensuales.xlsx`)

Para no perder nada de lo que ya funciona, esto es lo que identifiqué en su Excel actual:

**Gastos fijos (por mes, divididos en Quincena 15 y Quincena 30):**
Casa, Servicios, Internet, Chat GPT, Administración, Seguro Carro, Gasolina, Arriendo, Mercado, Aseo, Otros.
Cada mes calculan un **% de split** (ej. Mateo 45.7% / Daniela 54.3%) que cambia según los ingresos de cada uno ese mes, y de ahí sacan cuánto le corresponde a cada quien por quincena.

**Gastos variables compartidos (tabla de eventos puntuales):**
Item · Valor · Quién pagó · Cuánto le toca a Mateo · Cuánto le toca a Daniela · Fecha de pago límite · Estado (OK / pendiente).

Este es el mecanismo clave que describiste: si Mateo paga algo de $200.000 con vencimiento 15/08/2026, y a Daniela le tocan $150.000, el sistema debe quedar registrado como **"Daniela le debe $150.000 a Mateo, vence 15/08/2026"** — y cuando Daniela se lo transfiera a Mateo, se marca como pagado y desaparece de pendientes.

La app que construyamos debe **replicar y mejorar** esta lógica, no reinventarla.

---

## 2. Objetivo del sistema

Un lugar único con:
1. **Panel personal** de cada uno (100% privado, el otro no lo ve, ni siquiera Claude lo ve en el chat)
2. **Panel de pareja** (compartido, ambos ven y editan)
3. Un **motor de liquidación** que siempre sepa "quién le debe a quién y cuánto"

---

## 3. Módulos y funcionalidades

### 3.1 Autenticación y onboarding (multi-hogar, configurable)

Cambio importante respecto a la primera versión: el sistema **no asume que siempre son ustedes dos**. Es un sistema multi-hogar desde el diseño, para que después pueda reutilizarse con cualquier otra pareja/roommates sin tocar el modelo de datos.

**Flujo de primer uso:**
1. Usuario entra a la app → pantalla de login
2. Si el usuario no existe → **Registro** (nombre, usuario, contraseña)
3. Al terminar el registro, si el usuario no pertenece a ningún hogar → se le pregunta:
   - **Crear un hogar nuevo** (le pone nombre) → se convierte en el primer miembro/administrador
   - **Unirse a un hogar existente** (con un código/enlace de invitación generado por el otro miembro)
4. Dentro del hogar, desde **Settings → Miembros**, el administrador puede invitar a más personas (genera un código o link de invitación de un solo uso)
5. Desde **Settings del hogar** se configuran:
   - Conceptos de gastos fijos (crear, editar, desactivar — ya no vienen hardcodeados, ver sección 3.3a)
   - % de split entre miembros (editable cuando quieran, igual que hoy en el Excel)
   - Vinculación del bot de Telegram (ver sección 3.5)

**Sesión:** cookie httpOnly de larga duración (~1 año), pensada para anotar rápido desde el celular sin re-loguearse constantemente.

### 3.2 Panel personal (privado)
- Registro de gastos personales, incluyendo **gastos puntuales** (item, monto, fecha, categoría opcional) — igual que los gastos puntuales de pareja, pero sin reparto, ya que son solo tuyos
- **Ingreso personal por corte:** reutiliza la misma cadencia de corte del hogar (semanal/quincenal/mensual, definida en 3.3a) para que sepas cuánto te entró en cada periodo. Dos modos, configurables por ti:
  - **Automático:** defines un monto default (ej. tu sueldo fijo) y el sistema lo agrega solo al iniciar cada nuevo periodo de corte
  - **Manual:** no se agrega nada solo — tú (o el bot) registras el ingreso real cada vez, útil si tus ingresos varían (freelance, comisiones, etc.)
  - Puedes cambiar de modo cuando quieras desde Settings personales
- Presupuesto mensual por categoría
- Deudas personales (igual que el Excel que ya armamos: saldo, tasa, pago mínimo, meses restantes, prioridad avalancha)
- Metas de ahorro personales
- Dashboard con gráficos (gasto por categoría, evolución mensual, ingreso vs. gasto por periodo)
- **Registro también disponible desde el bot de Telegram** (ver 3.5): puedes decirle "gasto personal: 30.000 en cine" o "me entraron 2.500.000 de sueldo" y lo registra directamente en tu panel privado — el bot distingue automáticamente si es algo tuyo o algo de pareja según cómo lo escribas, y si no queda claro, te pregunta
- **Garantía de aislamiento:** estos datos solo los ve el dueño. No se comparten con el otro usuario ni se exponen en ninguna conversación de Claude — esto aplica también a lo que registras por el bot: la API valida que la escritura quede scopeada a tu usuario, nunca visible para tu pareja ni para el agente cuando responde preguntas de hogar.

### 3.3 Panel de pareja (compartido)

**a) Gastos recurrentes del hogar (antes "fijos" — ahora incluye monto variable)**
- **Frecuencia configurable a nivel de hogar** (Settings del hogar): semanal, quincenal o mensual. Ya no está amarrado a "quincena" — el hogar elige su propio ciclo, y el sistema calcula las fechas de cada periodo según eso (ej. si es semanal, cada 7 días; si es mensual, un corte al mes)
- Catálogo **100% configurable desde Settings del hogar** — no vienen predefinidos en el código. Al crear el hogar puede partir de una plantilla sugerida (Casa, Servicios, Internet, etc.) pero cualquier miembro con permiso puede crear, editar o desactivar conceptos
- **Cada concepto se marca como "monto fijo" o "monto variable":**
  - **Monto fijo** (ej. Arriendo, Internet, ChatGPT): mismo valor cada periodo, se autocompleta, editable si cambia
  - **Monto variable** (ej. Mercado, Gasolina, Servicios): no tiene un valor por defecto — cada periodo alguien debe ingresar cuánto fue esta vez, pero sigue siendo parte del ciclo recurrente del hogar, **no** un gasto puntual de la sección (b). Esto resuelve exactamente el caso que planteaste: mercado/gasolina/servicios varían mes a mes, pero no tienen "fecha de vencimiento" propia como un gasto variable puntual — simplemente entran al corte del periodo junto con los demás
- % de split entre los miembros del hogar (editable cuando quieran, igual que hoy)
- **A qué corte aplica cada concepto (nuevo):** cuando la frecuencia es quincenal (o cualquier frecuencia con más de un punto de corte por ciclo), cada concepto se configura para aplicar a **todos los cortes** o solo a **uno específico**. Ejemplo tuyo: si tienes cortes el 15 y el 30, puedes tener "Arriendo" solo en el corte del 30, "Gimnasio" solo en el del 15, y "Mercado" en ambos — se configura por concepto, no es todo-o-nada para el hogar completo
- Cada instancia periódica queda "pendiente de liquidar" hasta que se resuelve en un **corte** (ver sección c)

**b) Gastos variables compartidos**
- Formulario: Item, Valor total, Quién pagó, Fecha límite de pago, reparto (% o monto fijo por persona)
- Cálculo automático de cuánto debe quien no pagó
- Estado: Pendiente / Pagado, con fecha de pago real

**c) Cortes (liquidación por lotes) — el corazón del sistema**

Esto reemplaza la idea simple de "cuenta corriente en tiempo real" por algo más fiel a cómo lo usan de verdad: **los cortes son eventos periódicos** (con la frecuencia que definiste en 3.3a: semanal, quincenal o mensual) donde se decide, en conjunto, qué se liquida y qué no.

**Cómo funciona:**
1. El sistema calcula automáticamente los **puntos de corte** según la frecuencia del hogar — ej. quincenal = dos puntos por mes (15 y último día); mensual = uno; semanal = uno por semana
2. Al llegar cada punto de corte, se generan las instancias de los conceptos recurrentes **que aplican a ese punto específico** (según lo configurado en 3.3a — todos, o solo ese punto)
3. Cualquiera de los dos puede **iniciar un corte** cuando quiera — no tiene que ser el mismo día del punto nominal. Ejemplo tuyo: el punto de corte nominal es "30 de julio", pero lo inician el 10 de agosto
3. Al iniciar el corte, el sistema junta **todos los pendientes con fecha ≤ la fecha nominal del corte** (fecha vencida o exactamente en la fecha): tanto instancias de gastos recurrentes (3.3a) como gastos variables puntuales (3.3b)
4. Todos aparecen **pre-seleccionados** (checkbox marcado) para incluirse en este corte
5. **Pueden deseleccionar** cualquier ítem que en la vida real todavía no se ha pagado — ese ítem queda pendiente y **pasa automáticamente al próximo corte**, sin perderse
6. Al confirmar el corte, el sistema calcula el neto final: *"Daniela le debe a Mateo $X"* (o al revés), sumando y restando todo lo incluido
7. El corte queda **cerrado** con fecha de ejecución real, y sirve como historial — se puede consultar cualquier corte pasado con el detalle de qué se incluyó

**Vista de "cuenta corriente" (resumen en vivo):**
- Sigue existiendo, pero ahora significa: *"esto es lo que está pendiente de meter al próximo corte"* — no un saldo que se salda al instante ítem por ítem
- Historial de todos los cortes cerrados, con su detalle completo

**d) Deudas conjuntas**
- Mismo modelo que las personales, pero a nivel pareja (ej. crédito para el matrimonio)

**e) Inversiones conjuntas**
- Registro manual de aportes, tipo de inversión, valor actual

**f) Metas de ahorro en pareja**
- Fondo de emergencia conjunto, viaje, cuota inicial de vivienda, etc.

### 3.5 Bot de Telegram vía n8n (chat + notificaciones)

Decisión: el bot **no vive dentro del backend de la app**. Vive en **n8n** (desplegado como servicio aparte en tu mismo VPS/EasyPanel), que orquesta todo y habla con la app a través de una API interna protegida. Esto mantiene la app simple y deja toda la lógica de mensajería/IA en un lugar diseñado para eso.

**Vinculación (login directo desde el chat, sin pasos previos en la app):**
- La primera vez que le escribes al bot desde un `chat_id` de Telegram desconocido, el flujo de n8n responde preguntando *"¿Quién eres?"* y pide usuario y contraseña
- n8n llama a un endpoint de la app (`POST /api/n8n/login`) que valida esas credenciales igual que el login normal de la web
- Si son correctas, la app devuelve el `usuario_id` y n8n guarda la relación `telegram_chat_id ↔ usuario_id` de forma permanente
- **De ahí en adelante, el bot nunca vuelve a preguntar** — asume que ese `chat_id` siempre corresponde a ese usuario ya logueado, igual que la sesión sin vencimiento de la web
- **Nota de seguridad honesta:** escribir la contraseña directamente en el chat de Telegram queda en el historial de esa conversación (en los servidores de Telegram) y potencialmente en los logs de ejecución de n8n si no se configuran para no guardar datos sensibles. Para tu caso (uso privado, VPS propio) el riesgo es bajo, pero vale configurar n8n para que ese workflow específico no persista el contenido del mensaje con la contraseña en su historial de ejecuciones, y lo ideal es que borres el mensaje del chat después de loguearte

**Registro de gastos, ingresos y asesoría por chat (lenguaje natural vía n8n, con contexto real):**
- Escribes libremente, ej. *"pagué 200.000 de internet, le tocan 90.000 a Dani"* (gasto de pareja), *"gasto personal: 30.000 en cine"* (privado, solo tuyo), *"me entraron 2.500.000 de sueldo"* (ingreso personal), o *"¿debería pagar primero la deuda o ahorrar este mes?"* (asesoría)
- **Proveedor de IA recomendado: Claude (Anthropic).** La razón concreta: para que de verdad "conozca" la situación financiera de la persona (no solo extraiga datos del mensaje), el nodo **AI Agent de n8n** se conecta con **tool calling** a herramientas que llaman a la API interna de la app — `consultar_gastos_usuario`, `consultar_balance_pareja`, `consultar_deudas`, `registrar_gasto_pareja`, `registrar_gasto_personal`, `registrar_ingreso_personal`, etc. Así Claude consulta tus números reales antes de responder, en vez de dar consejos genéricos
- **Cómo distingue personal de pareja:** por el lenguaje del mensaje ("gasto personal", "solo mío", vs. mencionar a tu pareja o un ítem que ya saben que es compartido). Si el mensaje es ambiguo, el agente pregunta antes de registrar — nunca asume que algo es de pareja por defecto, para no arriesgar tu privacidad
- Modelo sugerido: **Claude Sonnet** para las preguntas de asesoría/análisis (mejor razonamiento); si el volumen de mensajes crece y el costo importa, se puede usar un modelo más económico solo para el registro simple de gastos y reservar Sonnet para las preguntas de consejo
- Workflow: `Telegram Trigger` → `AI Agent` (con las tools de arriba) → según la intención, llama a la tool correspondiente (escribe en pareja, escribe en personal, o solo consulta) → responde por Telegram
- La app nunca confía ciegamente en lo que llega de n8n: valida que el `usuario_id` resuelto exista, pertenezca al hogar correcto, y que los montos cuadren antes de guardar. Además, las escrituras a datos personales quedan estrictamente scopeadas a ese `usuario_id` — la API no permite que se filtren a consultas de hogar

**Recordatorios de vencimiento:**
- Workflow separado con `Cron Trigger` → consulta `GET /api/n8n/pendientes` de la app → si hay algo por vencer, envía el mensaje de Telegram al usuario correspondiente

**Resumen periódico (bajo demanda, por usuario — ver también sección 3.4):**
- No se envía automáticamente por defecto. Cada usuario, desde **Administración → Notificaciones** dentro de la app, activa si quiere resumen y con qué frecuencia (semanal, quincenal o mensual)
- Esa preferencia se guarda por usuario (no por hogar) — así cada quien recibe solo lo que pidió, a su propio chat de Telegram
- Un workflow de n8n con `Cron Trigger` revisa periódicamente qué usuarios tienen resumen activo y a cuáles les toca según su frecuencia configurada, y les envía el suyo

**Permisos por miembro (configurables por el creador del hogar desde Administración):**
- Cada miembro tiene dos permisos **independientes** entre sí:
  1. **Editar** — puede modificar conceptos de gastos fijos y % de split
  2. **Invitar/Compartir** — puede generar invitaciones para que nuevas personas se unan al hogar
- El creador del hogar decide, por cada miembro, si tiene ninguno, uno, o ambos permisos
- **El rol de administrador/creador es transferible.** Desde Administración, el admin actual puede transferirlo a otro miembro del hogar (ej. Mateo se lo pasa a Daniela) — a partir de ahí, el nuevo admin es quien controla los permisos de los demás. Solo puede haber un admin activo a la vez por hogar
- Esto aplica igual en la app web y en lo que el agente de n8n puede hacer en nombre de cada usuario (la API de la app valida el permiso sin importar si la llamada viene de la web o de n8n)

**Piezas técnicas que esto agrega:**
- Servicio n8n desplegado aparte en EasyPanel
- Endpoints internos en la app: `POST /api/n8n/gastos`, `GET /api/n8n/pendientes`, `POST /api/n8n/login`, `POST /api/n8n/cortes`, protegidos con un token de servicio (no con el login normal de usuario)
- Tabla de vinculación Telegram ↔ usuario, y tabla/campos de preferencias de notificación por usuario

**Ejemplo práctico (con datos reales de tu Excel):**

Corte nominal 30/07/2026, iniciado el 10/08/2026. Pendientes antes del corte:
`Mercado $513.500` (recurrente, variable) · `Internet $162.291` (recurrente, fijo) · `Gasolina $200.000` (recurrente, variable) · `Creta $253.000` (variable, vence 28/07) · `Regalo cumpleaños $100.000` (variable, vence 02/08 — **no entra**, es del próximo corte).

El sistema junta los 4 primeros (fecha ≤ 30/07) preseleccionados en `corte_items`. Si desmarcas "Creta" porque aún no se ha pagado, al confirmar: los otros 3 pasan a `estado='liquidado'` en su tabla de origen, y "Creta" **sigue en `estado='pendiente'`** — por eso reaparece sola en el siguiente corte, sin que nadie la vuelva a digitar. El registro en `corte_items` (con `incluido=false`) deja constancia de que se consideró y se pospuso, no que se perdió.

### 3.4 Dashboard y reportes
- Gasto mensual por categoría (personal y pareja, por separado)
- Evolución histórica mes a mes (igual que ya lo llevan)
- Balance neto entre los dos
- Progreso de metas y deudas

---

## 4. Modelo de datos (entidades principales)

```
usuarios
  id, nombre, usuario, password_hash, hogar_id, es_admin(bool),
  puede_editar_gastos(bool), puede_invitar(bool)

hogares
  id, nombre, frecuencia_corte(semanal/quincenal/mensual)

puntos_corte_hogar
  id, hogar_id, orden(1,2...), referencia (ej. "dia_15", "fin_de_mes", "lunes")

conceptos_recurrentes_pareja
  id, hogar_id, nombre (Casa, Servicios, Internet...), activo,
  tipo_monto(fijo/variable), monto_default (solo aplica si tipo_monto=fijo)

concepto_puntos_corte
  id, concepto_id, punto_corte_id
  -- si un concepto no tiene filas aquí, aplica a TODOS los puntos de corte
  -- si tiene una o más, aplica SOLO a esos puntos específicos

gastos_personales
  id, usuario_id, categoria, monto, fecha, descripcion, tipo(recurrente/puntual),
  origen(app/bot)

ingresos_personales_config
  id, usuario_id, monto_default, modo(automatico/manual)

ingresos_personales_instancia
  id, usuario_id, corte_ref_fecha (misma cadencia que hogares.frecuencia_corte),
  monto, origen(automatico/manual/bot)

presupuestos_personales
  id, usuario_id, categoria, monto_meta, mes, anio

deudas_personales
  id, usuario_id, nombre, saldo, tasa_interes, pago_minimo

metas_ahorro_personales
  id, usuario_id, nombre, monto_meta, monto_actual, fecha_meta

split_porcentaje
  id, hogar_id, periodo_inicio, pct_usuario1, pct_usuario2

log_transferencia_admin
  id, hogar_id, usuario_anterior_id, usuario_nuevo_id, fecha

invitaciones_hogar
  id, hogar_id, codigo, usado(bool), creado_por_usuario_id, expira_en

telegram_links
  id, usuario_id, telegram_chat_id, vinculado_en

preferencias_notificacion
  id, usuario_id, resumen_activo(bool), frecuencia(semanal/quincenal/mensual)

tokens_servicio
  id, nombre(ej. "n8n"), token_hash, activo

gastos_recurrentes_instancia
  id, concepto_id, periodo(fecha de inicio del ciclo), punto_corte_id,
  monto, monto_usuario1, monto_usuario2, estado(pendiente/incluido_en_corte/liquidado)

gastos_variables_pareja
  id, hogar_id, item, valor_total, pago_usuario_id, fecha_limite,
  monto_usuario1, monto_usuario2, estado(pendiente/incluido_en_corte/liquidado)

cortes
  id, hogar_id, fecha_nominal, fecha_ejecucion, estado(abierto/cerrado),
  creado_por_usuario_id, neto_final, deudor_final_usuario_id

corte_items
  id, corte_id, tipo_origen(recurrente/variable), origen_id,
  incluido(bool), monto

deudas_pareja / metas_ahorro_pareja / inversiones_pareja
  (mismo patrón, a nivel hogar_id)
```

La tabla `cortes` (con su detalle en `corte_items`) es el corazón del sistema: cada gasto recurrente o variable pendiente entra en el próximo corte disponible, y ahí se decide en conjunto qué se liquida ahora y qué se pospone.

---

## 5. Arquitectura propuesta

**Recomendación: NO todo-en-uno. Backend desacoplado + Vue.js + Capacitor/Ionic Vue para el APK.**

Cambié de recomendación respecto a la primera versión de este documento (ahí sugería Next.js todo-en-uno) porque mencionaste que quieres una app móvil (APK). Ese dato cambia la decisión: si construyes todo acoplado en Next.js, cuando quieras el APK vas a terminar re-escribiendo el frontend desde cero. Si lo desacoplas desde el inicio, reutilizas casi todo.

- **Backend (API pura):** Node.js + Express (o Fastify) + Prisma + PostgreSQL — expone una API REST/JSON, sin mezclar lógica de presentación. La usan tres clientes por igual: la web, el APK, y n8n
- **Frontend web:** Vue 3 + Vite, consumiendo esa API
- **App móvil (APK):** **Capacitor + Ionic Vue**, envolviendo ese mismo proyecto Vue 3. Ionic Vue te da los componentes con look-and-feel nativo (listas, tabs, formularios táctiles), y Capacitor empaqueta el resultado en un APK instalable, con acceso a funciones nativas si luego las necesitas (notificaciones push nativas, cámara para fotos de recibos, etc.)
- **Resultado práctico:** compartes la enorme mayoría del código Vue entre web y móvil — no son dos frontends distintos, es el mismo con una capa de empaquetado distinta

**Trade-off honesto:** esto es más piezas que un monolito Next.js (backend separado del frontend, dos servicios que desplegar en vez de uno). Pero dado que sí quieres el APK, es menos trabajo total a mediano plazo que construir dos veces.

- **ORM:** Prisma
- **Autenticación:** JWT o cookie de sesión de larga duración (~1 año) + contraseñas con bcrypt — el APK guardaría el token localmente (almacenamiento seguro de Capacitor) para no volver a pedir login, igual que pediste
- **Gráficos:** Recharts (web) — en Ionic Vue hay wrappers de charting igual de sencillos si el mismo componente no renderiza bien dentro del shell nativo
- **Estilos:** Tailwind CSS, compatible con Ionic Vue
- **Automatización/Bot:** n8n como servicio independiente, habla con el backend vía API interna autenticada con token de servicio
- **IA del agente conversacional:** Claude (Anthropic), vía tool calling desde el nodo AI Agent de n8n (ver sección 3.5)

**Una pregunta antes de cerrar esto del todo:** ¿el APK lo quieres desde el inicio del proyecto, o es algo que planeas agregar más adelante (ej. después de tener la web funcionando)? Si es "más adelante", igual recomiendo el backend desacoplado desde ya — no cuesta nada extra ahora y evita el retrabajo después.

---

## 6. Infraestructura en tu VPS (EasyPanel)

- 1 servicio **PostgreSQL** (EasyPanel lo despliega en un clic)
- 1 servicio **Backend/API** (Docker, Node.js + Express + Prisma)
- 1 servicio **Frontend web** (Docker, build estático de Vue 3 servido por Nginx — o se puede empaquetar dentro del mismo contenedor del backend si prefieres un solo despliegue; lo definimos al construir)
- **n8n:** ya lo tienes instalado — solo hace falta crear ahí los workflows nuevos y conectarlo a la API del backend
- Conexión entre servicios por red interna de EasyPanel (variables de entorno: `DATABASE_URL`, y la URL interna de la API de la app para que n8n la llame)
- Subdominio con SSL automático para la app (ej. `finanzas.tudominio.com`) — necesario porque Telegram exige que el webhook sea HTTPS (n8n ya debería tener el suyo si está funcionando). **Pendiente:** aún no tienes dominio — cualquier registrador sirve (Namecheap, Cloudflare Registrar, GoDaddy); apuntas un registro A a la IP de tu VPS y EasyPanel emite el certificado SSL automáticamente al crear el servicio con ese subdominio. No es bloqueante para empezar a construir — solo se necesita antes de conectar el webhook real de Telegram
- Backups: **definido así** — `pg_dump` automático diario vía cron dentro del VPS, comprimido y con **retención de 14 días** (se borran los más viejos automáticamente). Recomendación adicional: subir una copia semanal a almacenamiento externo barato (ej. Backblaze B2 o un bucket S3-compatible) para no depender 100% del mismo VPS si algo le pasa al disco — esto es opcional pero barato y evita perderlo todo en un solo punto de falla
- Variables de entorno nuevas en la app: un `SERVICE_TOKEN` que la app usa para autenticar las llamadas que le hace n8n. En n8n: `ANTHROPIC_API_KEY` para el nodo AI Agent, y el `TELEGRAM_BOT_TOKEN` (gratis con @BotFather) si aún no lo tienes configurado

---

## 7. Plan de fases sugerido

| Fase | Contenido |
|---|---|
| 1 | Backend (API) + esquema de base de datos + autenticación + onboarding (crear/unirse a hogar) |
| 2 | Frontend web (Vue 3): login, panel personal básico |
| 3 | Settings del hogar: frecuencia de corte, conceptos configurables (fijo/variable), invitar miembros, % de split, permisos |
| 4 | Panel de pareja: gastos recurrentes + gastos variables puntuales |
| 5 | Motor de **cortes** (el mecanismo de liquidación por lotes) |
| 6 | Dashboard con gráficos (personal y pareja) |
| 7 | API interna para n8n (endpoints protegidos) + workflows: login por chat, registro de gastos, recordatorios |
| 8 | Workflow de n8n: resúmenes bajo demanda con frecuencia configurable por usuario |
| 9 | Deudas y metas de ahorro (personal y pareja), inversiones conjuntas, exportar datos |
| 10 | Empaquetado móvil: Capacitor + Ionic Vue → APK |

---

## 8. Decisiones ya tomadas

- ✅ Hogares multi-usuario configurables, con flujo de registro → crear/unirse a hogar → invitar miembros
- ✅ Categorías de gastos recurrentes configurables desde Settings del hogar, cada una marcada como **monto fijo** o **monto variable**
- ✅ Frecuencia de corte configurable por hogar: semanal, quincenal o mensual
- ✅ Liquidación por **cortes**: eventos periódicos donde se seleccionan/deseleccionan los pendientes a liquidar, con los desmarcados pasando al siguiente corte
- ✅ Notificaciones, registro de gastos y asesoría conversacional vía Telegram, orquestado con **n8n** (ya instalado en tu VPS)
- ✅ Login del bot: pregunta usuario/contraseña la primera vez, luego recuerda el `chat_id` para siempre
- ✅ IA del agente: **Claude (Anthropic)** con tool calling hacia la API de la app, para respuestas basadas en datos reales del usuario, no genéricas
- ✅ Permisos por miembro, independientes entre sí: **editar** gastos/split, e **invitar** nuevos miembros — configurables uno por uno desde Administración
- ✅ Rol de administrador/creador del hogar: **transferible** a otro miembro, uno activo a la vez
- ✅ Resúmenes periódicos: opt-in por usuario, frecuencia configurable (semanal, quincenal o mensual), activado desde Administración dentro de la app — no automático por defecto
- ✅ Backups: `pg_dump` diario, retención 14 días, copia semanal opcional a almacenamiento externo
- ✅ Dominio: pendiente de reservar (no bloqueante para empezar a construir)
- ✅ Arquitectura: **backend desacoplado** (API pura) + **frontend Vue 3 responsive/mobile-first** + **Capacitor/Ionic Vue** para el APK en una fase posterior (una vez la web esté funcionando, sin rediseño)

---

## Estado: especificación completa ✅

Ya tenemos definidos funcionalidades, modelo de datos (incluyendo el mecanismo detallado de cortes), arquitectura, stack, infraestructura y todas las reglas de negocio. No quedan preguntas de diseño pendientes.

**Siguiente paso natural:** cuando quieras, pasamos de este documento a un plan de implementación fase por fase (empezando por Fase 1 de la sección 7), donde sí entraríamos a escribir código — solo cuando tú lo confirmes.

Ya tenemos definidos funcionalidades, modelo de datos, arquitectura, stack, infraestructura y todas las reglas de negocio (permisos, liquidaciones, notificaciones). No quedan preguntas de diseño pendientes — lo único abierto (dominio) es operativo y no bloquea el inicio de la construcción.

**Siguiente paso natural:** cuando quieras, pasamos de este documento a un plan de implementación fase por fase (empezando por Fase 1 de la sección 7), donde sí entraríamos a escribir código — solo cuando tú lo confirmes.
