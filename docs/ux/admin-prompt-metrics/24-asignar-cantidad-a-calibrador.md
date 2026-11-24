# 24 · Asignar una cantidad de llamadas a un calibrador

- **Pedido (Johannes, textual, 2026-11-24):** «voy a necesitar que desde administrador pueda asignar a un calibrador la cantidad de casos que quiera.»
- **Base:** Módulo de calibración (`23`), implementado y en `develop` (`d9136eb`). Rama: `feature/asignar-cantidad-calibrador`.
- **Tipo:** cambio menor sobre `13` (reparto) y `23`. Un gate. **Legal:** omitido por instrucción de Johannes.
- **Estado:** AC1-AC4 no aprobadas; Johannes aclaró el alcance (§0). Propuesta reformulada en §5. **AD1-AD4 aprobadas, todas A** (2026-11-24, Johannes: «Sí, todas en A»); H-AD1 confirmado (la cantidad se suma). Especificación en §6. Listo para implementar.

## 0. Aclaración de Johannes (2026-11-24, textual)

«la idea es que pueda asignar todas las llamadas a alguien si quiero, o repartirlas en varios o volver a asignar a otra persona llamadas ya asignadas.»

Tres casos de uso: **U1** todas a una persona; **U2** repartir entre varias, con la cantidad que quiera por persona; **U3** reasignar a otra persona llamadas ya asignadas.

## 1. Cómo funciona hoy (verificado en el código)

| Pieza | Comportamiento |
|---|---|
| `assignments.plan()` (`src/call_audit/assignments.py`) | Toma **todas** las llamadas sin asignar y no calibradas de la corrida completa y las reparte entre los calibradores marcados, a la de menor carga (contando lo que ya tenían). No hay tope por persona. |
| Orden | Recorre los estratos segmento × set **uno tras otro** (`promptFn`, `promptFp`, `reviewer`, `undecided`, `agree`); dentro de cada estrato, orden aleatorio fijo (`order_key`). |
| `distribute()` | Guarda las asignaciones del plan y registra `verification_distributed` en la bitácora. |
| `move_pending()` | Pasa **todas** las pendientes de una persona a otras, turnándolas. No acepta cantidad. |
| `set_assignee()` | Una llamada a la vez (desde el caso). |
| API (`routes_verification.py`) | `DistributeIn { userIds }`; `/distribute/preview` y `/distribute`. `MoveIn { fromUserId, toUserIds }`. |
| Front (`verification-view.tsx`) | Sección «Calibradores»: botón «Repartir llamadas» → diálogo con casillas por calibrador + tabla previa (llamadas por parte del mosaico). Tabla de avance: Asignadas / Calibradas / Pendientes / Avance / Última actividad + «Pasar pendientes a…». Fila «Sin asignar». |

**Hallazgos:**

- **P-AC1.** No hay forma de dar a alguien una cantidad: el reparto siempre vacía «Sin asignar». Para dar 50 a una persona hoy habría que asignar de a una.
- **P-AC2.** Si solo se pone un tope a `plan()` («las N primeras»), se rompe la estratificación: como los estratos se recorren en secuencia, las primeras N saldrían casi todas de `promptFn` (desacuerdos en que Qubyt dice Cumple). Con cantidad hay que cortar **proporcional por estrato** (resto mayor) para que cada lote sea representativo de la corrida.
- **P-AC3.** No existe «devolver» pendientes a Sin asignar por cantidad; solo pasarlas todas a otra persona.

## 2. Propuesta

- **Dónde:** el mismo diálogo «Repartir llamadas». Cada calibrador marcado muestra un campo numérico «Llamadas» (opcional). Vacío = reparto parejo de lo que quede, como hoy; con número = exactamente esa cantidad. Botón «Asignar N llamadas». La tabla previa sigue mostrando el desglose por parte del mosaico.
- **Qué llamadas toma:** las siguientes sin asignar y no calibradas, en el orden aleatorio fijo, repartidas proporcionalmente entre segmento × set (P-AC2). Lo ya asignado no se mueve.
- **Si pide más de las disponibles:** el campo valida contra «Sin asignar» (suma de todas las cantidades ≤ disponibles); mensaje «Quedan N llamadas sin asignar.» y el botón se deshabilita hasta corregir. No asigna parcial en silencio.
- **Bajar la cantidad:** en la tabla de avance, el menú de la fila suma «Devolver pendientes…» con campo numérico (máx. = pendientes de esa persona); devuelve las **últimas** en el orden fijo a Sin asignar. Lo calibrado y lo empezado (con algún criterio calibrado) no se devuelve.
- **Backend:** `DistributeIn` pasa a `{ userIds, counts?: {userId: n} }`; `plan()` con cupo por persona y corte proporcional por estrato; nuevo `release_pending(user_id, n)` + endpoint `/verification/release`; bitácora `verification_released`. Sin migración.

## 3. Decisiones (AC) — reemplazadas por §5

| ID | Pregunta | A (recomendada) | B |
|---|---|---|---|
| AC1 | Dónde se pone la cantidad | Campo por calibrador en el diálogo «Repartir llamadas»; vacío = parejo | Acción aparte por fila «Asignar N llamadas…» |
| AC2 | Qué llamadas toma | Siguientes sin asignar en orden fijo, proporcional por segmento × set | Siguientes en orden fijo sin estratificar (las primeras serían casi todas desacuerdos) |
| AC3 | Si pide más de las disponibles | Validar y bloquear con «Quedan N sin asignar» | Asignar las que haya y avisar |
| AC4 | Bajar la cantidad | Sí: «Devolver pendientes…» con cantidad, solo pendientes sin empezar | No por ahora (se sigue usando «Pasar pendientes a…») |

## 4. Supuestos y riesgos

- **H-AC1 [SUPUESTO]:** la cantidad es «cuántas más le doy ahora» (se suma a lo que ya tiene), no «total que debe tener». Si Johannes piensa en total, el campo mostraría «Asignadas: X → Y».
- **R-AC1:** con cantidades chicas (p. ej. 5) el corte proporcional deja estratos en 0; es esperable y se ve en la tabla previa.
- **R-AC2:** devolver pendientes de alguien que las está trabajando le cambia la bandeja en vivo; por eso se excluyen las llamadas con algún criterio calibrado.

## 5. Propuesta reformulada (tras la aclaración)

### Qué existe hoy por caso de uso

| Caso | Hoy | Falta |
|---|---|---|
| U1 Todas a una persona | «Repartir llamadas» marcando un solo calibrador ya le da todo lo sin asignar | Nada de backend; solo que se entienda en el diálogo |
| U2 Repartir con cantidad | Reparto parejo entre los marcados | Cantidad por persona, con corte proporcional por segmento × set (P-AC2) |
| U3 Reasignar | «Pasar pendientes a…» mueve **todas** las pendientes de una persona, turnándolas; desde el caso se reasigna de a una (`set_assignee`) | Elegir cantidad y a quién; devolver a «Sin asignar» |

### Un solo flujo: diálogo «Asignar llamadas»

Reemplaza «Repartir llamadas» y «Pasar pendientes a…» (desde la fila del calibrador se abre el mismo diálogo con el origen ya puesto).

1. **Desde:** «Sin asignar (N)» o «Pendientes de <calibrador> (N)».
2. **A quién:** lista de calibradores activos (más «Sin asignar» cuando el origen es una persona). Cada uno marcado tiene un campo «Llamadas».
3. **Cantidad:** el campo vacío reparte parejo lo que quede; con número asigna esa cantidad. Atajo «Todas» cuando hay un solo destino.
4. **Vista previa** con el desglose por parte del mosaico (como hoy) y botón «Asignar N llamadas».

U1 = Desde Sin asignar, un destino, Todas. U2 = varios destinos, con o sin cantidades. U3 = Desde una persona, uno o varios destinos (o Sin asignar).

**Backend:** un endpoint `/verification/assign` con `{ fromUserId | null, targets: [{userId | null, count | null}] }` que generaliza `plan`/`distribute`/`move_pending`; preview igual. Bitácora `verification_assigned_bulk`. Sin migración.

### Decisiones (AD)

| ID | Pregunta | A (recomendada) | B |
|---|---|---|---|
| AD1 | Flujo | Un solo diálogo «Asignar llamadas» (Desde → A quién → cuántas), que reemplaza Repartir y Pasar pendientes | Mantener los dos y agregarles cantidad |
| AD2 | Qué se reasigna en U3 | Solo pendientes (incluye empezadas; los criterios ya calibrados conservan su autor). Lo calibrado no cambia de dueño | También las calibradas (mueve el avance de una persona a otra) |
| AD3 | Cuáles reasignar | Por cantidad o todas, tomadas en el orden fijo, proporcional por segmento × set | Además, elegirlas una a una (selección en la lista de llamadas) |
| AD4 | Si pide más de las disponibles | Validar y bloquear: «Quedan N llamadas disponibles.» | Asignar las que haya y avisar |

### Supuestos y riesgos

- **H-AD1 [SUPUESTO]:** la cantidad es «cuántas le paso ahora» (se suma a lo que ya tiene).
- **R-AD1:** reasignar una llamada empezada deja al nuevo calibrador con criterios ya calibrados por otro; se muestran como hechos y él completa el resto.
- **R-AD2:** reasignar le cambia la bandeja en vivo a quien está trabajando; aceptable para el admin, sin aviso extra.
- Sigue vigente la reasignación de una llamada desde el caso (`set_assignee`).

## 6. Especificación de implementación (aprobada)

### Backend

**`src/call_audit/assignments.py`**
- `plan_assign(session, evaluation, from_user_id: str | None, targets: list[tuple[str | None, int | None]]) -> dict`:
  - Origen: `from_user_id=None` → llamadas sin asignar y sin calibrar (como `plan()`); con id → pendientes de esa persona (incluidas empezadas; nunca calibradas, AD2).
  - Destinos: calibradores activos (rol Calibrador) o `None` = Sin asignar (solo si el origen es una persona). Sin destinos válidos → `ValueError("no_verifiers")`; destino = origen → se ignora.
  - Cupos: destinos con `count` reciben exactamente ese número; los sin `count` se reparten parejo el resto (a la de menor carga, como hoy). Si todos tienen `count`, el sobrante queda en el origen.
  - AD4: si la suma de `count` > disponibles → `ValueError("not_enough")` con `available`. `count` < 1 → `ValueError("bad_count")`.
  - Selección (AD3): orden aleatorio fijo (`order`) por estrato segmento × set; el total a mover se corta **proporcional por estrato** (resto mayor, empate por orden de `SEGMENTS`); luego se asigna turnándose dentro de cada estrato para que cada persona reciba una mezcla proporcional. Desde una persona: se toman sus pendientes en el mismo orden.
  - Devuelve `{calls, available, people:[{id, name, calls, bySegment}], _picks}` (`id=null`, `name="Sin asignar"` para devolver).
- `assign(...)`: aplica `_picks` (crear / actualizar `user_id`, `assigned_by_id`, `assigned_at`; destino `None` = borrar la fila); los criterios ya calibrados no se tocan (conservan autor). Bitácora `verification_assigned_bulk`, objetivo `v<versión>`, detalle `«Desde <Sin asignar|nombre>: <nombre> N · …»`.
- `plan()` / `distribute()` con `only` se mantienen (los usa el reparto desde una planilla); `move_pending()` se borra o queda como envoltorio de `assign` con todos los pendientes. `set_assignee()` sin cambios.

**`src/call_audit/api/routes_verification.py`**
- `AssignTargetIn {userId: str | None, count: int | None}`; `AssignIn {fromUserId: str | None = None, targets: list[AssignTargetIn]}`.
- `POST /admin/prompts/{version}/verification/assign/preview` y `POST .../assign` (rol Admin, corrida `full`). Errores 422: `no_verifiers`, `bad_count`, `not_enough` (con `{"detail": "not_enough", "available": N}`).
- Se quitan `/distribute`, `/distribute/preview` y `/move` (o quedan sin uso del front; preferible quitarlos y ajustar tests).

**`tests/test_assignments.py`**: cupo exacto; parejo con y sin cupos mezclados; proporción por estrato (con 3 estratos y count chico, ningún estrato se lleva todo); AD4 bloquea; desde persona → solo pendientes, calibradas intactas, criterios calibrados conservan autor; devolver a Sin asignar; destino = origen ignorado; adaptar los de `distribute`/`move`.

### Front

**`frontend/src/lib/api/client.ts`, `http-api.ts`, `admin-types.ts`, `mock/admin-mock.ts`**: `previewAssign(version, body)` y `assign(version, body)` → `AssignPlan {calls, available, people[]}`; quitar `previewDistribution`, `distribute`, `movePending`.

**`verification-view.tsx`, sección «Calibradores»**
- Se quitan `DistributeDialog`, `MoveDialog`, el botón «Repartir llamadas» y el botón de fila «Pasar pendientes a…».
- Botón de cabecera **«Asignar llamadas»** (primario) → diálogo con origen Sin asignar. En la fila de un calibrador con pendientes > 0, botón ghost **«Reasignar…»** → mismo diálogo con origen esa persona.
- `AssignDialog` (ancho 640):
  - Título: **«Asignar llamadas»**. Descripción: «Se mueven solo llamadas pendientes. Lo ya calibrado no cambia de dueño.»
  - Campo **«Desde»** (select): «Sin asignar (N)» · «Pendientes de <nombre> (N)» por calibrador con pendientes.
  - Fieldset **«A quién»**: por calibrador activo (sin el origen) una casilla con el nombre, su carga actual en ayuda («Tiene N pendientes») y, si está marcado, un campo numérico **«Llamadas»** (min 1, placeholder «Parejo»). Si el origen es una persona, primera opción **«Sin asignar (devolver)»**.
  - Atajo: con un solo destino marcado, botón link **«Todas (N)»** que llena el campo con las disponibles.
  - Ayuda bajo la lista: «Vacío = se reparte parejo lo que quede.»
  - Vista previa (igual a la tabla actual): Calibrador · Llamadas · columnas por parte del mosaico; se recalcula al cambiar (debounce ~300 ms).
  - Pie: «Cancelar» · primario **«Asignar N llamadas»**, deshabilitado sin destinos, con error o con N = 0.
  - Éxito: toast «Asignadas N llamadas.» (desde persona: «Reasignadas N llamadas de <nombre>.»), cierra y refresca el avance.
  - Estados: sin calibradores activos → «No hay cuentas Calibrador activas.»; origen sin llamadas → «No quedan llamadas sin asignar.» / «<nombre> no tiene pendientes.»; AD4 → error en línea bajo la lista, `role="alert"`: «Quedan N llamadas disponibles.» y campos con `aria-invalid`; cantidad < 1 → «Ingresa un número mayor que 0.»; error de red → «No pudimos calcular la vista previa. Reintenta.» / «No se pudo asignar. Reintenta.»
  - Accesibilidad: cada campo numérico con `aria-label="Llamadas para <nombre>"`; foco inicial en «Desde»; Enter no envía si hay error.
- La reasignación de una llamada desde el caso (`case-review.tsx`) no cambia.
