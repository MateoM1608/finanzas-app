# Ajustes al Panel Personal — para implementar

> Este documento describe **cómo debe quedar el panel personal completo** (no solo el diff) — úsalo para revisar qué ya existe en el código y qué falta agregar o ajustar. No es necesario rehacer lo que ya funcione igual a esto; ajusta solo lo que difiera.

---

## 1. Objetivo del módulo

El panel personal no es una libreta de transacciones — es para que el usuario sepa, sin calcular nada mentalmente, **cuánto tiene realmente disponible ahora mismo**, sin que gastos "comprometidos pero no efectivos todavía" (ej. algo cargado a tarjeta de crédito) lo distorsionen.

---

## 2. Catálogos configurables (Settings personales)

### 2.1 Métodos de pago
Catálogo libre por usuario (ej. "Tarjeta Bancolombia", "Nequi", "Efectivo"). Cualquier gasto o ingreso puede etiquetarse con uno (opcional).

```
metodos_pago_personales
  id, usuario_id, nombre
```

### 2.2 Categorías
Catálogo libre por usuario, **reutilizable en gastos, ingresos y ahorros por igual** (ej. "Ocio", "Inversión inmobiliaria", "Fondo de emergencia", "Sueldo"). No vienen predefinidas.

```
categorias_personales
  id, usuario_id, nombre, aplica_a (gasto / ingreso / ahorro — puede marcar más de uno)
```

---

## 3. Ingresos

### 3.1 Ingresos fijos (configuración)
```
ingresos_fijos_config
  id, usuario_id, nombre, monto, frecuencia (semanal/quincenal/mensual),
  modo (automatico/manual), categoria_id (nullable)
```
- **Automático:** el día que corresponde según la frecuencia, se crea la instancia ya con `estado = recibido`.
- **Manual:** se crea la instancia en `estado = pendiente` ese día; el usuario la marca `recibido` cuando de verdad entra.

### 3.2 Ingresos (instancias, incluye esporádicos)
```
ingresos_personales
  id, usuario_id, origen_config_id (nullable si es esporádico),
  monto, fecha, estado (recibido/pendiente),
  metodo_pago_id (nullable), categoria_id (nullable), origen (app/bot)
```
Un ingreso esporádico es simplemente una fila aquí sin `origen_config_id`, creada directamente por el usuario o el bot, con `estado` inicial a su elección (recibido o pendiente).

---

## 4. Gastos

### 4.1 Gastos fijos (configuración)
```
gastos_fijos_config
  id, usuario_id, nombre, monto, frecuencia (semanal/quincenal/mensual),
  modo_cobro (automatico/manual), es_obligatorio (bool),
  metodo_pago_id_default (nullable), categoria_id (nullable)
```
- **Automático** (débito automático): el día que corresponde, se crea la instancia ya con `estado = pagado`.
- **Manual:** se crea `pendiente` ese día; el usuario la marca `pagado` cuando de verdad sale la plata. Así funcionan naturalmente los gastos de tarjeta de crédito — quedan registrados pero no afectan el disponible hasta que se pagan.
- **`es_obligatorio`:** marca si este gasto cuenta como "obligatorio" para efectos del módulo de Ahorros (sección 6). No todo gasto fijo es obligatorio (ej. una suscripción de streaming puede ser fija pero no obligatoria).

### 4.2 Gastos (instancias, incluye esporádicos)
```
gastos_personales
  id, usuario_id, origen_config_id (nullable si es esporádico),
  monto, fecha, descripcion, estado (pagado/pendiente),
  es_obligatorio (bool), metodo_pago_id (nullable), categoria_id (nullable),
  origen (app/bot/corte_hogar)
```
- Un gasto esporádico es una fila aquí sin `origen_config_id`, con su propio `es_obligatorio` (ej. una factura médica inesperada puede marcarse obligatoria aunque no sea recurrente).
- **`origen = corte_hogar`:** cuando se cierra un corte del hogar, el sistema debe generar automáticamente una fila aquí por la parte que le tocó liquidar a este usuario, con `estado = pagado`, `es_obligatorio = true`, y una referencia al corte de origen (agregar campo `corte_id` nullable si no existe ya un mecanismo de referencia). **Importante: el campo `fecha` de este gasto debe ser la `fecha_nominal` del corte (ej. 30 de julio), NUNCA la `fecha_ejecucion`** (ej. 10 de agosto) — de lo contrario el gasto cae en el periodo personal equivocado solo porque el corte se ejecutó tarde. Esto ajusta el disponible del usuario sin que tenga que registrarlo manualmente, y hace que ese ítem cuente en la evaluación de obligatorios del periodo al que realmente pertenece (sección 6).

---

## 5. Cálculo del "Disponible"

Métrica principal del dashboard personal, sin acción manual del usuario:

```
Disponible = Σ(ingresos_personales con estado = recibido)
           − Σ(gastos_personales con estado = pagado)
```

Lo que está en `pendiente` (cualquier tipo) **no afecta** este número — se muestra aparte en una vista de **"Compromisos pendientes"**, ordenados por fecha.

Dashboard debe incluir además:
- Comparación del Disponible vs. el periodo anterior (flecha arriba/abajo) — usando la misma `config_ciclo_personal` definida en Settings generales (sección 6.3), no una frecuencia aparte
- Gasto por categoría
- Indicador de en qué fase del plan financiero está el usuario (mini fondo de emergencia → atacando deuda con método avalancha → fondo completo) — esto ya debería derivarse de las deudas y metas de ahorro existentes

---

## 6. Módulo de Ahorros con ciclos y alertas

Este es el módulo nuevo más importante de este documento.

### 6.1 Metas de ahorro (configuración)
```
ahorros_personales
  id, usuario_id, nombre (ej. "Viaje a España"),
  monto_meta_total (nullable — el usuario puede no poner tope),
  regla_tipo (porcentaje/monto_fijo), regla_valor,
  base_calculo (ingreso_menos_obligatorios/disponible_total — default: ingreso_menos_obligatorios),
  modo_transaccion (manual/automatico), categoria_id (nullable), activo (bool)
```
- `regla_tipo`/`regla_valor` **solo generan la sugerencia/alerta de cuánto ahorrar** — no mueven plata.
- `base_calculo` (configurable por cada meta, no global): define sobre qué número se aplica `regla_valor`:
  - **`ingreso_menos_obligatorios`** (default): `Ingreso − Obligatorios` — protegida, no se reduce por gastos no-obligatorios ya hechos en el periodo (ver 6.6)
  - **`disponible_total`**: `Ingreso − Obligatorios − No-obligatorios ya gastados` — se ajusta sola a lo que de verdad queda disponible, pero como consecuencia **si gastas en algo no-obligatorio antes de la evaluación, el pronóstico de esa meta baja por eso**
- `modo_transaccion`: si es `automatico`, se debita un monto fijo (definido aparte, no confundir con `regla_valor`) cada vez que se evalúa un periodo (sección 6.4); si es `manual`, el usuario registra sus aportes cuando quiera.

### 6.2 Transacciones de ahorro (aportes reales)
```
ahorro_transacciones
  id, ahorro_id, monto, fecha, origen (manual/automatico/bot)
```

### 6.3 Configuración del ciclo personal (vive en Settings generales, no dentro de Ahorros)

**No hay "cortes" ni un evento de cierre en el panel personal.** El ciclo es una **ventana de calendario configurable**, con su propia frecuencia (independiente de la del hogar, aunque el usuario puede elegir la misma si quiere), pero sin ninguna acción manual ni estado que transicionar.

**Importante sobre dónde vive esta configuración:** es una **única configuración a nivel de todo el panel personal**, no algo particular del módulo de Ahorros — el dashboard general (sección 5, "comparación vs. periodo anterior") también la usa. Si viviera dentro de Ahorros, un usuario sin metas de ahorro activas no tendría cómo definir su periodo para el dashboard, y podría llegar a haber dos "periodos" corriendo sin sincronizarse. Se configura una sola vez en **Settings generales del panel personal**, y tanto el dashboard como el módulo de Ahorros la consultan:

```
config_ciclo_personal
  id, usuario_id, frecuencia (semanal/quincenal/mensual)
```

Con esa frecuencia, el sistema calcula los periodos de forma puramente automática (ej. quincenal → periodos [1-15], [16-fin de mes]). No existe un estado `abierto/cerrado` — es un rango de fechas que se consulta cada vez que hace falta, no un registro que alguien "cierra".

### 6.4 Evaluación de los disparadores (alerta / débito automático de ahorro)

Cada vez que se paga un gasto obligatorio (o mediante una revisión periódica programada), se evalúa **el periodo que contiene esa fecha, según la frecuencia configurada**:

```
Para el periodo que contiene la fecha del gasto recién pagado:
  → ¿Todos los gastos_personales con es_obligatorio=true y fecha dentro de
     ese rango ya están en estado=pagado?
     (incluye los generados por corte_hogar, usando su fecha_nominal —
      ver sección 4.2, NUNCA la fecha de ejecución del corte)
  → Si SÍ y este periodo aún no había sido evaluado antes:
        - Registrar la evaluación de ese periodo (sección 6.5)
        - Disparar alerta / débito automático de cada meta activa
  → Si NO, o si ese periodo ya fue evaluado antes: no hacer nada
```

Como el chequeo es **por rango de fechas** (no por transición de estado de un registro), un gasto pagado tarde igual cuenta para el periodo al que pertenece según su `fecha` — por eso es crítico que el gasto generado por el corte de hogar lleve la `fecha_nominal` del corte, no la de ejecución.

**Nota para implementación:** los gastos que "pertenecen" a un periodo son todos los `gastos_personales` (fijos o esporádicos) con `es_obligatorio=true` cuya `fecha` cae dentro del rango de ese periodo.

### 6.5 Registro de la evaluación (no es un "cierre", es un cálculo que se guarda una vez por periodo)

```
periodos_ahorro_evaluados
  id, usuario_id, periodo_inicio, periodo_fin,
  ingreso_periodo, gastos_obligatorios_periodo, gastos_no_obligatorios_periodo,
  base_calculo_ahorro, evaluado_en (timestamp de cuándo se disparó)
```
- `ingreso_periodo` = suma de ingresos con `estado=recibido` y `fecha` dentro del rango
- `gastos_obligatorios_periodo` = suma de gastos obligatorios `pagado` con `fecha` dentro del rango
- `gastos_no_obligatorios_periodo` = suma de gastos NO obligatorios `pagado` con `fecha` dentro del rango (informativo, ver 6.6)
- `base_calculo_ahorro = ingreso_periodo − gastos_obligatorios_periodo`
- Se crea **una sola vez por periodo**, la primera vez que se cumple la condición de 6.4 — evita disparar la misma alerta repetidamente para un periodo ya evaluado

### 6.6 Cálculo del pronóstico de ahorro (por cada meta activa)

```
Si ahorro.base_calculo = "ingreso_menos_obligatorios" (default):
    Base = base_calculo_ahorro   (ya calculado en 6.5: ingreso_periodo − gastos_obligatorios_periodo)

Si ahorro.base_calculo = "disponible_total":
    Base = base_calculo_ahorro − gastos_no_obligatorios_periodo

Pronóstico de ahorro = Base × regla_valor
                        (si regla_tipo = porcentaje)
                     = regla_valor
                        (si regla_tipo = monto_fijo)
```

**Importante — el default no restar gastos no-obligatorios:** con `base_calculo = ingreso_menos_obligatorios` (la opción por defecto), el pronóstico **no se reduce** por lo ya gastado en no-obligatorios — se muestra aparte, informativo, para no "desangrar" la meta solo porque el usuario gastó en algo discrecional temprano en el periodo. Si el usuario elige `disponible_total` para una meta específica, acepta explícitamente que esa meta sí se ajuste hacia abajo según lo que ya gastó.

**Alerta de sobregasto (no reduce la meta, solo notifica):**
```
Si (gastos_no_obligatorios_periodo + Σ pronósticos de todas las metas activas) > base_calculo_ahorro:
  → Mostrar alerta: "vas a tener que recortar gastos más adelante en
     este periodo si quieres cumplir tu ahorro"
```
La meta y su pronóstico **no cambian** por esta alerta — es solo informativa.

```
ahorro_pronosticos
  id, ahorro_id, periodo_id (FK a periodos_ahorro_evaluados),
  monto_sugerido, monto_ahorrado_real, color
```

### 6.7 Semáforo visual (por meta, por periodo)

Comparar `monto_ahorrado_real` (suma de `ahorro_transacciones` de esa meta dentro del rango del periodo) contra `monto_sugerido`:

| Condición | Color | Ejemplo de texto |
|---|---|---|
| ahorrado < sugerido | 🟡 Amarillo | "Ahorrado $200.000 el 12/08 · Pronóstico $350.000" |
| ahorrado = sugerido | 🔵 Azul | "Ahorrado $350.000 · Meta cumplida" |
| ahorrado > sugerido | 🟢 Verde | "Ahorrado $400.000 · Superaste el pronóstico" |

**En la parte superior del módulo de Ahorros:** suma total ahorrada entre todas las metas activas (todos los ciclos, acumulado).

---

## 7. Módulo de Límites y Alertas por categoría (dashboard, parte superior)

Generaliza y reemplaza `presupuestos_personales` (que quedaba amarrado a mes calendario) — ahora usa el mismo `config_ciclo_personal` (sección 6.3) que Ahorros, para que todo el panel personal hable el mismo lenguaje de periodos.

### 7.1 Configuración de un límite
```
limites_alerta_personal
  id, usuario_id, nombre (ej. "Tope de Ocio", "Máximo en Obligaciones"),
  tipo_objetivo (categoria / obligatorios / no_obligatorios / todo_gasto),
  categoria_id (nullable — solo aplica si tipo_objetivo = categoria),
  regla_tipo (porcentaje/monto_fijo), regla_valor, activo (bool)
```
- `categoria`: el límite aplica a los gastos etiquetados con esa categoría (sección 2.2)
- `obligatorios`: aplica a la suma de todos los gastos con `es_obligatorio=true` (ej. "que mis obligaciones no superen el 50% del ingreso")
- `no_obligatorios`: aplica a la suma de todo lo discrecional junto
- `todo_gasto`: aplica al total gastado en el periodo, sin distinción
- **Por defecto, el porcentaje se calcula sobre el ingreso total del periodo** (`ingreso_periodo`, el mismo valor que ya calculamos en 6.5) — así todos los límites usan la misma base y no se generan lecturas contradictorias entre sí

### 7.2 Evaluación por periodo
Reutiliza los mismos rangos de `config_ciclo_personal`. **Para el ciclo actual (en curso)**, se recalcula en tiempo real, sin tabla propia:
```
limite_calculado = (regla_tipo = porcentaje) ? ingreso_periodo × regla_valor : regla_valor
monto_gastado    = suma de gastos_personales pagados en el periodo que matchean el tipo_objetivo
disponible_restante = limite_calculado − monto_gastado
estado = (monto_gastado <= limite_calculado) ? "dentro" : "excedido"
```

**Para ciclos ya finalizados (históricos), esto NO es suficiente** — si el usuario cambia `regla_valor` de un límite más adelante, recalcular en vivo un ciclo pasado le aplicaría retroactivamente una regla que en ese momento no existía, distorsionando el historial. Por eso se guarda un snapshot la primera vez que se consulta o se cierra ese periodo:

```
limite_evaluado_periodo
  id, limite_id, periodo_inicio, periodo_fin,
  regla_valor_usado, limite_calculado, monto_gastado,
  disponible_restante, estado, evaluado_en
```
Una vez que un periodo queda en el pasado (ya no es el ciclo actual), sus lecturas de límites deben venir de esta tabla, no recalcularse con la configuración vigente hoy.

### 7.3 Visualización en el dashboard
Arriba de todo el panel personal, una tarjeta por cada límite activo:
- 🟢 **Verde** ("dentro"): *"Ocio: $320.000 de $500.000 · Disponible $180.000"*
- 🔴 **Rojo** ("excedido"): *"Obligaciones: 54% de tu ingreso (tope 50%) · Excedido por 4%"*

### 7.4 Navegación entre ciclos (histórico)

El dashboard completo (Disponible, gasto por categoría, Ahorros, Límites) debe poder navegarse por ciclo, no solo mostrar el actual:

- **Movimientos crudos (ingresos, gastos, transacciones de ahorro):** se consultan por rango de fechas directamente contra las tablas base — no requieren nada adicional, ya que los datos ya existen tal como se registraron
- **Ahorros:** el histórico sale de `periodos_ahorro_evaluados` / `ahorro_pronosticos` (sección 6.5), que ya guardan snapshot por periodo
- **Límites:** el histórico sale de `limite_evaluado_periodo` (arriba), nunca recalculado con la configuración actual

**Mecanismo de navegación sugerido:** un índice relativo de periodo (`0` = ciclo actual, `-1` = el anterior, `-2`, etc.), que el backend traduce a un rango de fechas concreto usando `config_ciclo_personal`, y desde ahí resuelve qué consultar según lo anterior. Así el frontend solo necesita botones de "anterior/siguiente", sin que el usuario maneje fechas manualmente.

---

## 8. Registro vía bot de Telegram (si ya está implementado)

Todo lo anterior (gastos, ingresos, ahorros) debe poder registrarse también desde el bot:
- El bot distingue si un registro es personal o de pareja según el lenguaje del mensaje; si es ambiguo, pregunta antes de registrar — nunca asume que algo es de pareja por defecto
- Las escrituras que vengan del bot quedan con `origen = bot` y estrictamente scopeadas al `usuario_id` correspondiente — la API nunca debe permitir que un registro personal quede visible en consultas de hogar

---

## 9. Resumen de qué es nuevo vs. qué ya podría existir

Si en el código actual ya existe una versión más simple de gastos/ingresos personales, esto **reemplaza/extiende** con:
- Separación explícita fijo (config recurrente) vs. esporádico (instancia suelta)
- `modo`/`modo_cobro` automático vs. manual en los fijos
- `es_obligatorio` como campo nuevo en gastos
- Catálogos de métodos de pago y categorías (nuevos, si no existen)
- Todo el módulo de Ahorros con ciclos (sección 6) — esto es completamente nuevo, no existía en el diseño original
- Todo el módulo de Límites y Alertas por categoría (sección 7) — reemplaza el antiguo `presupuestos_personales` atado a mes calendario; si ese código ya existe, hay que migrarlo a este nuevo modelo basado en periodos
