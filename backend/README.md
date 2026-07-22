# Finanzas — Backend

API REST en Node.js + Express + Prisma + PostgreSQL. Fase 1: autenticación y onboarding. Fase 2: gastos personales. Fase 3: settings del hogar (miembros, permisos, conceptos recurrentes, split). Fase 4: panel del hogar (gastos recurrentes por período + gastos variables puntuales, con split por contexto y reparto personalizable por gasto). Fase 5: motor de cortes (liquidación por lotes).

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

## Notas de diseño

- El esquema de Prisma solo incluye las tablas necesarias hasta la fase actual; el resto del modelo de datos se agrega incrementalmente en fases posteriores.
- Al crear un hogar se generan puntos de corte por defecto según la frecuencia elegida (ej. quincenal → día 15 y fin de mes); editables desde Settings del hogar. `PuntoCorteHogar.referencia` es una etiqueta libre editable; el cálculo de fechas real usa `diaMes`/`diaSemana`, campos estructurales que el usuario no edita directamente, para que renombrar la etiqueta no rompa el cálculo del período actual (`src/utils/periodoActual.js`).
- El split de porcentaje se modela como una fila por miembro (`SplitPorcentajeMiembro`), no como columnas fijas `usuario1`/`usuario2` — el modelo de datos soporta hogares de N personas, no solo parejas. Los repartos de gastos recurrentes/variables siguen el mismo patrón (`GastoRecurrenteInstanciaReparto`, `GastoVariableParejaReparto`).
- "Quién pagó" y "cómo se reparte" son conceptos separados: el pagador tiene un default configurable por concepto (`pagadorDefaultUsuarioId`) pero es editable en cada instancia hasta que un corte la liquide; el reparto es siempre proporcional al split vigente del hogar (o manual, en variables puntuales).
- El motor de cortes calcula el punto de atraso a cerrar por el **más reciente** que ya pasó, no el más antiguo sin cerrar (`src/utils/periodoActual.js#calcularProximaFechaNominalPendiente`) — como un corte junta todo lo pendiente con fecha ≤ su fecha nominal sin importar cuán viejo sea, un solo corte atrasado atrapa todo el backlog de una vez, en vez de forzar un corte por cada período que quedó sin cerrar. Esa función solo sabe de fechas, no de qué hay realmente pendiente — por eso `iniciarCorte` (en `cortes.service.js`) prueba primero ese candidato de atraso contra los datos reales, y si no encuentra nada pendiente ahí, prueba con el período actual (`calcularPeriodoActual`) antes de rendirse. Esto evita el caso de un hogar nuevo o al día: sin esta segunda pasada, un concepto recurrente recién registrado quedaría atrapado en el período actual (con fecha nominal en el futuro) sin ninguna forma de incluirse en un corte hasta que el período completo transcurriera, mientras que los gastos variables sí podían tener cualquier fecha pasada.
- Las instancias de gastos recurrentes ya NO dependen de que alguien visite una pantalla para existir: antes solo se generaban al pedir `GET /api/gastos-recurrentes/periodo-actual`, así que un concepto que nadie consultó a tiempo (ej. un "Arriendo" quincenal fijo) nunca tenía instancia y el motor de cortes jamás lo encontraba pendiente, aunque su fecha ya hubiera pasado — la generación (`asegurarInstanciasRecurrentes`, extraída a `gastosRecurrentes.service.js` para reusarla) ahora también corre dentro de `iniciarCorte`, para cada punto pendiente (atraso + actual), antes de buscar qué incluir.
- Todo acceso a datos que dependa del usuario autenticado se filtra a nivel de query por su `id`/`hogarId`, nunca solo en la capa de aplicación.
