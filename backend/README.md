# Finanzas — Backend

API REST en Node.js + Express + Prisma + PostgreSQL. Fase 1: autenticación y onboarding. Fase 2: gastos personales. Fase 3: settings del hogar (miembros, permisos, conceptos recurrentes, split). Fase 4: panel del hogar (gastos recurrentes por período + gastos variables puntuales, con split por contexto y reparto personalizable por gasto). Fase 5: motor de cortes (liquidación por lotes). Fase 6: endpoints de agregación para el dashboard. Fase 7 (en curso): reestructuración completa del panel personal — Etapa 1 (catálogos, gastos/ingresos fijos-o-esporádicos con estado pagado/pendiente), Etapa 2 (Disponible + ciclo personal, resumen movido a los módulos de dominio en vez de un módulo `dashboard` aparte) y Etapa 3 (Ahorros con ciclos y evaluación automática — ver `Modulo_Panel_Personal_Ajustes.md`).

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
- `PATCH /:id` — editar nombre/activo/tipoMonto/montoDefault/pagadorDefaultUsuarioId. Si el `tipoMonto` final queda en `fijo`, exige `montoDefault`; si queda en `variable`, lo limpia a `null`. Requiere admin o `puedeEditarGastos`.
- `PUT /:id/puntos-corte` — `{ puntoCorteIds: [] }` → a qué puntos de corte aplica; array vacío = aplica a todos. Requiere admin o `puedeEditarGastos`.
- `DELETE /:id` — elimina el concepto. Falla con 409 si ya tiene gastos recurrentes generados en algún período (usa `PATCH { activo: false }` para desactivarlo sin perder ese historial). Requiere admin o `puedeEditarGastos`.

### Split de porcentaje (`/api/split-porcentaje`) — requieren sesión activa
- `GET /?contexto=general|gastos_variables` — split vigente para ese contexto (el más reciente con `periodoInicio` ≤ hoy). `contexto` es opcional, default `general`.
- `PUT /?contexto=general|gastos_variables` — `{ splits: [{ usuarioId, porcentaje }] }` → los porcentajes deben sumar 100% entre todos los miembros del hogar (soporta N miembros, no solo 2). Cada actualización crea un nuevo período con fecha de hoy para ese contexto, preservando el historial. Requiere admin o `puedeEditarGastos`.

Hay dos contextos independientes: `general` (lo usan los gastos recurrentes) y `gastos_variables` (default para gastos variables puntuales, ver más abajo). Son splits separados a propósito — configurar uno no toca el otro.

### Gastos recurrentes (`/api/gastos-recurrentes`) — requieren sesión activa
- `GET /periodo-actual` — calcula el punto de corte vigente (según `frecuenciaCorte` y los puntos de corte del hogar) y devuelve/genera (vía `asegurarInstanciasRecurrentes`) las instancias de los conceptos activos que aplican a ese punto. Los conceptos de monto fijo se generan con su `montoDefault` y reparto ya calculado (según el split `general`); los variables quedan con `monto: null` hasta que alguien lo complete en un corte. Es idempotente — no duplica instancias si ya existen para ese período. Panel del hogar solo la usa para un modal de solo lectura; el pagador/monto se define en Cortes, no aquí.
- `PATCH /instancias/:id` — `{ monto?, pagoUsuarioId? }`. Igual semántica que la edición desde un corte abierto, pero pensada para editar una instancia todavía `pendiente` (antes de que un corte la tome). No editable si está `incluido_en_corte` o `liquidado` — para ese caso ver `PATCH /api/cortes/:id/items/:itemId`. Requiere admin o `puedeEditarGastos`.

### Gastos variables puntuales (`/api/gastos-variables`) — requieren sesión activa
- `GET /` — lista los gastos del hogar ordenados por fecha límite
- `POST /` — `{ item, valorTotal, pagoUsuarioId, fechaLimite, repartos? }`. Si no se pasa `repartos`: usa el split del contexto `gastos_variables` si está configurado, y si no, cae automáticamente al split `general`. Si se pasa `repartos` explícito (reparto personalizado para ESE gasto puntual), debe sumar exactamente `valorTotal` y cada `usuarioId` debe pertenecer al hogar — no afecta ningún split guardado, solo aplica a ese gasto. Requiere admin o `puedeEditarGastos`.
- `PATCH /:id` — igual que crear, todos los campos opcionales; cambiar `valorTotal` o pasar `repartos` recalcula el reparto de ese gasto, cambiar solo `pagoUsuarioId` no lo toca. No editable si ya está `liquidado`.
- `DELETE /:id` — solo si sigue `pendiente`.

### Cortes (`/api/cortes`) — requieren sesión activa
- `GET /` — historial de cortes del hogar (abiertos y cerrados), más reciente primero
- `GET /actual` — el corte `abierto` del hogar, o `null` si no hay ninguno
- `GET /:id` — detalle completo de un corte (para consultar el historial)
- `POST /` — inicia un corte nuevo, o refresca y devuelve el que ya está abierto si existe. Antes de buscar pendientes, **asegura** (`asegurarInstanciasRecurrentes`) que existan las instancias de cada concepto recurrente para todo punto todavía sin cerrar (atraso, hasta 2 ciclos atrás) y para el período actual — así un concepto que nadie visitó a tiempo (ej. Arriendo) no se pierde por falta de instancia. Si ya hay un corte `abierto`, en vez de devolverlo tal cual lo **refresca** (`agregarPendientesAlCorte`): busca cualquier pendiente (recurrente o variable) con fecha ≤ la fecha nominal de ese corte que todavía no tenga un `CorteItem` ahí, y lo agrega — así un corte que quedó abierto antes de que existiera un concepto (o su instancia) lo recoge en la siguiente visita en vez de quedar pegado para siempre con lo que tenía al crearse. Para un corte nuevo, prueba primero con el punto de corte más reciente ya vencido y sin cerrar (atraso); si ahí no hay ningún gasto pendiente de verdad, cae al período **actual**, aunque su fecha nominal todavía no haya llegado. Junta todos los pendientes con fecha ≤ la fecha nominal elegida — instancias recurrentes (con o sin monto todavía) + gastos variables — y los pre-selecciona (`incluido: true`); un concepto recurrente de monto variable (ej. Mercado) entra sin precio, para definirlo ahí mismo antes de cerrar. Si ninguna de las dos fechas tiene algo pendiente de verdad, responde `{ corte: null, motivo: "..." }` en vez de crear un corte vacío. Requiere admin o `puedeEditarGastos`.
- `PATCH /:id/items/:itemId` — acepta `{ incluido }` (toggle) o `{ monto?, pagoUsuarioId? }` (edición), en el mismo endpoint. Solo mientras el corte sigue `abierto`. Al desmarcar, el gasto origen vuelve a `pendiente` (así reaparece solo en el siguiente corte); al marcar, se recalcula el `monto` desde el origen por si cambió (falla con 409 si el origen todavía no tiene monto). `monto`/`pagoUsuarioId` editan directamente el origen (instancia recurrente o gasto variable) y, si cambia `monto`, recalculan su reparto — `monto` solo aplica a ítems `recurrente` (los `variable` ya traen su valor definido desde que se crearon); esto es lo que permite definir en el corte el valor de un concepto recurrente de monto variable. Requiere admin o `puedeEditarGastos`.
- `POST /:id/confirmar` — cierra el corte: los ítems que sigan `incluido` pasan a `liquidado`, se calcula el balance de cada miembro (lo que pagó menos lo que le tocaba pagar según reparto, sumando recurrentes y variables juntos) y se guarda en `corte_balance_miembro`. Falla con 409 si algún ítem incluido no tiene definido su `monto`, o no tiene definido quién pagó. Requiere admin o `puedeEditarGastos`.

El balance se guarda **por miembro** (positivo = le deben, negativo = debe), no como un único `deudor_final`/`neto_final` — con 2 personas se ve igual ("Daniela le debe $X a Mateo"), pero el modelo soporta N miembros. Solo puede haber un corte `abierto` por hogar a la vez. `CorteItem.monto` es nullable — un ítem recurrente de monto variable puede estar incluido en el corte sin precio todavía; lo que bloquea es confirmar el cierre, no la inclusión.

### Resumen de hogar (`GET /api/cortes/resumen`) — requiere sesión activa
Antes vivía en un módulo `dashboard` genérico junto con el resumen personal; ahora vive en el propio módulo `cortes` porque es de ahí de donde sale todo su dato. Agrega hasta los últimos 6 `Corte` **cerrados** del hogar: total recurrentes/variables por corte, balance por miembro de cada corte, cuánto ha pagado cada miembro en total en esa ventana, y si hay un corte `abierto` pendiente de revisar. No se basa en el calendario de puntos de corte — solo en cortes que realmente existen (ver nota de "períodos fantasma" más abajo).

### Ciclo personal (`/api/ciclo-personal`) — requiere sesión activa
- `GET /` — `Usuario.frecuenciaCicloPersonal` vigente (default `mensual`).
- `PATCH /` — `{ frecuenciaCicloPersonal }`. A diferencia de la frecuencia de corte del hogar, acá no hay puntos de corte que regenerar — el período se recalcula puramente por calendario cada vez que hace falta (`src/utils/cicloPersonal.js`), así que cambiarla no dispara ningún efecto secundario en el schema.

### Resumen personal (`GET /api/resumen-personal`) — requiere sesión activa
Reemplaza el antiguo `GET /api/dashboard/personal` de Fase 6. Devuelve:
- `disponible` — Σ ingresos `recibido` − Σ gastos `pagado`, **histórico completo** (no por período; es "cuánto tengo ahora").
- `neto` — `{ actual, anterior, variacionPct, periodoActualInicio, periodoActualFin }`: ingresos − gastos dentro del ciclo actual vs. el anterior, usando `Usuario.frecuenciaCicloPersonal` (reemplaza la comparación "mes actual vs. mes anterior" de Fase 6, que usaba mes calendario fijo).
- `compromisosPendientes` — gastos + ingresos en `pendiente`, combinados y ordenados por fecha ascendente.
- `serieMensual`/`porCategoria` — igual que en Fase 6 (hasta 6 meses con datos reales, categoría vía relación).

### Gastos personales (`/api/gastos-personales`) — requieren sesión activa
- `GET /` — antes de listar, **asegura** (`asegurarInstanciasFijas`) que existan las ocurrencias de cada `GastoFijoConfig` activo entre su `fechaInicio` y hoy, generándolas directamente como filas reales de `GastoPersonal` (no hay tabla de "instancia" separada ni evento de corte) — en estado `pagado` si el concepto es de cobro automático, `pendiente` si es manual. Devuelve todo (fijos ya generados + esporádicos) ordenado por fecha descendente.
- `POST /` — `{ monto, fecha, descripcion?, estado?, esObligatorio?, metodoPagoId?, categoriaId? }` → gasto esporádico (sin `origenConfigId`); `estado` default `pagado`.
- `PATCH /:id` — edita cualquier campo, incluido `estado` (para marcar `pendiente → pagado` una vez que un gasto de cobro manual efectivamente sale de la cuenta).
- `DELETE /:id` — solo gastos esporádicos; falla con 409 si el gasto viene de un `GastoFijoConfig` (`origenConfigId` no nulo) — si se permitiera, la próxima vez que se liste volvería a generarse esa misma fecha, porque el config seguiría activo. Para dejar de generarlas, desactiva el concepto fijo (`PATCH /api/gastos-fijos-config/:id { activo: false }`).

### Ingresos personales (`/api/ingresos-personales`) — requieren sesión activa
Mismo patrón exacto que gastos personales, sin `esObligatorio`: `GET /` asegura instancias de `IngresoFijoConfig` (`recibido` si es automático, `pendiente` si es manual), `POST /` crea esporádicos, `PATCH /:id` edita/marca `recibido`, `DELETE /:id` bloqueado para ingresos de origen fijo.

### Gastos fijos (`/api/gastos-fijos-config`) e ingresos fijos (`/api/ingresos-fijos-config`) — requieren sesión activa
- `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id` — CRUD del concepto recurrente (`nombre, monto, frecuencia, fechaInicio, modoCobro/modo, categoriaId?`; gastos además `esObligatorio`, `metodoPagoIdDefault?`). `fechaInicio` ancla la primera ocurrencia — las siguientes se calculan sumando el paso de la frecuencia (7/15 días o 1 mes calendario) desde ahí, sin "puntos de corte" compartidos como en el hogar: cada concepto fijo personal tiene su propio calendario independiente. `DELETE` falla con 409 si el concepto ya generó ocurrencias (usa `PATCH { activo: false }` para desactivarlo sin perder el historial).

### Catálogos personales — `/api/metodos-pago-personales` y `/api/categorias-personales` — requieren sesión activa
- `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id` — CRUD simple por usuario. `DELETE` falla con 409 si el método/categoría ya está referenciado por algún gasto, ingreso o concepto fijo. Una categoría tiene `aplicaA: string[]` (subconjunto de `gasto`/`ingreso`/`ahorro`) — el mismo catálogo de categorías se reusa entre los tres módulos en vez de tener uno por tipo.

### Ahorros personales (`/api/ahorros-personales`) — requieren sesión activa
- `GET /` — lista plana de metas (para el CRUD de configuración).
- `POST /` — `{ nombre, montoMetaTotal?, reglaTipo: "porcentaje"|"monto_fijo", reglaValor, baseCalculo?, modoTransaccion: "automatico"|"manual", categoriaId? }`. `reglaTipo`/`reglaValor` solo generan la sugerencia — nunca mueven plata por sí solos.
- `PATCH /:id`, `DELETE /:id` — igual patrón que los demás catálogos/configs; `DELETE` falla con 409 si la meta ya tiene aportes o pronósticos (desactívala con `PATCH { activo: false }`).
- `POST /:id/transacciones` — `{ monto, fecha? }` → aporte manual (`origen: manual`); solo tiene sentido para metas `modoTransaccion: manual` (las automáticas se debitan solas al evaluarse un período).
- `GET /resumen` — la vista de Panel personal: antes de responder, **evalúa perezosamente** el período actual (`evaluarPeriodoSiCorresponde`) por si ya cumple la condición y nadie lo disparó pagando un gasto obligatorio. Devuelve `totalAhorradoAcumulado` (todas las metas activas, histórico), `alertaSobregasto` (para el período actual ya evaluado) y, por cada meta, sus últimos períodos evaluados con `montoSugerido`/`montoAhorradoReal`/`estado` (`amarillo`/`azul`/`verde`) — `montoAhorradoReal` se calcula sumando `AhorroTransaccion` dentro del rango en cada consulta, no se guarda como columna.

**Disparador de evaluación** (`src/utils/evaluacionAhorro.js#evaluarPeriodoSiCorresponde`): dado un `usuarioId` y una `fecha`, calcula el período (según `Usuario.frecuenciaCicloPersonal`) que la contiene; si ya fue evaluado, no hace nada (idempotente). Si no, revisa si **todos** los `GastoPersonal` con `esObligatorio: true` y `fecha` dentro de ese rango están `pagado` — si aún hay alguno `pendiente`, tampoco hace nada. Si se cumple, crea el snapshot `PeriodoAhorroEvaluado` (ingreso/obligatorios/no-obligatorios del período) y, por cada meta activa, su `AhorroPronostico` (`Base × reglaValor` o `reglaValor` fijo, según `baseCalculo`); si la meta es `modoTransaccion: automatico`, además crea de una vez su `AhorroTransaccion` por el monto sugerido. Se llama desde dos lugares: `gastosPersonales.service.js` (al crear o actualizar un gasto que quede `pagado` + `esObligatorio`) y `GET /api/ahorros-personales/resumen` (perezoso, cubre el caso de "revisión periódica" que el documento describe sin asumir que existe un cron en esta app).

## Notas de diseño

- El esquema de Prisma solo incluye las tablas necesarias hasta la fase actual; el resto del modelo de datos se agrega incrementalmente en fases posteriores.
- Al crear un hogar se generan puntos de corte por defecto según la frecuencia elegida (ej. quincenal → día 15 y fin de mes); editables desde Settings del hogar. `PuntoCorteHogar.referencia` es una etiqueta libre editable; el cálculo de fechas real usa `diaMes`/`diaSemana`, campos estructurales que el usuario no edita directamente, para que renombrar la etiqueta no rompa el cálculo del período actual (`src/utils/periodoActual.js`).
- El split de porcentaje se modela como una fila por miembro (`SplitPorcentajeMiembro`), no como columnas fijas `usuario1`/`usuario2` — el modelo de datos soporta hogares de N personas, no solo parejas. Los repartos de gastos recurrentes/variables siguen el mismo patrón (`GastoRecurrenteInstanciaReparto`, `GastoVariableParejaReparto`).
- "Quién pagó" y "cómo se reparte" son conceptos separados: el pagador tiene un default configurable por concepto (`pagadorDefaultUsuarioId`) pero es editable en cada instancia hasta que un corte la liquide; el reparto es siempre proporcional al split vigente del hogar (o manual, en variables puntuales).
- El motor de cortes calcula el punto de atraso a cerrar por el **más reciente** que ya pasó, no el más antiguo sin cerrar (`src/utils/periodoActual.js#calcularProximaFechaNominalPendiente`) — como un corte junta todo lo pendiente con fecha ≤ su fecha nominal sin importar cuán viejo sea, un solo corte atrasado atrapa todo el backlog de una vez, en vez de forzar un corte por cada período que quedó sin cerrar. Esa función solo sabe de fechas, no de qué hay realmente pendiente — por eso `iniciarCorte` (en `cortes.service.js`) prueba primero ese candidato de atraso contra los datos reales, y si no encuentra nada pendiente ahí, prueba con el período actual (`calcularPeriodoActual`) antes de rendirse. Esto evita el caso de un hogar nuevo o al día: sin esta segunda pasada, un concepto recurrente recién registrado quedaría atrapado en el período actual (con fecha nominal en el futuro) sin ninguna forma de incluirse en un corte hasta que el período completo transcurriera, mientras que los gastos variables sí podían tener cualquier fecha pasada.
- Las instancias de gastos recurrentes ya NO dependen de que alguien visite una pantalla para existir: antes solo se generaban al pedir `GET /api/gastos-recurrentes/periodo-actual`, así que un concepto que nadie consultó a tiempo (ej. un "Arriendo" quincenal fijo) nunca tenía instancia y el motor de cortes jamás lo encontraba pendiente, aunque su fecha ya hubiera pasado — la generación (`asegurarInstanciasRecurrentes`, extraída a `gastosRecurrentes.service.js` para reusarla) ahora también corre dentro de `iniciarCorte`, para cada punto pendiente (atraso + actual), antes de buscar qué incluir.
- Todo acceso a datos que dependa del usuario autenticado se filtra a nivel de query por su `id`/`hogarId`, nunca solo en la capa de aplicación.
- Resolver el origen real (nombre/pagador/reparto) de un `CorteItem` requería una query por ítem (`obtenerOrigenDetallado`, en un loop dentro de `enriquecerCorte`/`confirmarCorte`) — se extrajo `obtenerOrigenesDetalladosPorLote` (`src/utils/corteItemOrigen.js`) que resuelve todos los orígenes de una lista de ítems en dos queries (`findMany` con `id: { in: [...] }`, una para recurrentes y otra para variables), sin importar cuántos ítems tenga el corte o el historial completo. La reusa tanto `cortes.service.js` (incluido `obtenerResumenHogar`) como el histórico de cortes.
- Las instancias de gastos recurrentes de pareja NO se backfillean para todo el histórico calendario (ver nota en `iniciarCorte`) — solo existen para los períodos donde alguien realmente inició/consultó un corte. Por eso `obtenerResumenHogar` construye sus series iterando los `Corte` cerrados que existen de verdad, nunca asumiendo que todo punto de corte calendario tiene datos.
- **Panel personal reestructurado (Fase 7):**
  - **Etapa 1:** la iteración anterior de esta fase tenía un motor de "cortes personales" (concepto + instancia + mini-corte de revisión, calcado del de pareja) — se eliminó por completo (schema, endpoints y UI) a favor de un modelo más simple: `GastoFijoConfig`/`IngresoFijoConfig` generan directamente filas reales en `GastoPersonal`/`IngresoPersonal` (`asegurarInstanciasFijas`, en `gastosPersonales.service.js`/`ingresosPersonales.service.js`), sin ninguna tabla intermedia ni evento de "cierre" — la fila generada YA ES el gasto/ingreso real, en estado `pagado`/`pendiente` según el modo configurado. Cada concepto fijo ancla su calendario en su propia `fechaInicio` (`src/utils/instanciasFijas.js#calcularFechasPendientes`), sin depender de puntos de corte compartidos como el hogar.
  - **Etapa 2:** se eliminó el módulo `dashboard` genérico que mezclaba resumen personal y de hogar — cada resumen ahora vive en su propio dominio (`obtenerResumenHogar` en `cortes.service.js`, `resumenPersonal` como módulo nuevo). El ciclo personal (`cicloPersonal.js`) es deliberadamente más simple que el corte de hogar: sin puntos configurables, cada período se calcula puramente por calendario a partir de una sola frecuencia (`Usuario.frecuenciaCicloPersonal`). `disponible` es histórico a propósito (no por período) — es la métrica de "cuánto tengo ahora"; `neto` sí es por período, para poder compararlo contra el ciclo anterior.
  - **Etapa 3 — Ahorros:** `PeriodoAhorroEvaluado` se crea **una sola vez por período** (`@@unique([usuarioId, periodoInicio])`) — es lo que evita disparar la misma alerta/débito automático repetidamente para un período ya evaluado; la evaluación en sí es idempotente y se puede llamar de más sin efecto. `AhorroPronostico` guarda `montoSugerido` pero deliberadamente **no** guarda `montoAhorradoReal` ni el color del semáforo (a diferencia de como los describe `Modulo_Panel_Personal_Ajustes.md`) — se calculan en vivo sumando `AhorroTransaccion` dentro del rango del período cada vez que se consulta el resumen, para no tener que mantener un campo cacheado sincronizado a mano cada vez que entra un aporte nuevo. Tampoco hay cron en esta app para la "revisión periódica programada" que menciona el documento — se sustituye evaluando también de forma perezosa cada vez que se consulta `GET /api/ahorros-personales/resumen`, mismo patrón que `asegurarInstanciasFijas`.
  - Ver `Modulo_Panel_Personal_Ajustes.md` para el diseño completo de las etapas siguientes (Límites por categoría, integración con el corte de hogar, navegación histórica por ciclo).
