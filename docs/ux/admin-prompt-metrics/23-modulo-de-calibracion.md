# 23 · Módulo de calibración: de verificador a calibrador (revisión rápida, 2026-11-24)

Cambio menor sobre `18`-`22` (implementados, `develop` en `15b814e`). Un solo gate: decisiones AB1-AB5, **aprobadas el
2026-11-24 (§0 y §5 prevalecen sobre §1-§4 donde difieran)**. Legal y anonimización omitidos por instrucción de Johannes. En el front la IA se llama Qubyt.
«Revisor» sigue siendo el evaluador de la planilla (Z3 de `21`).

**Pedido (Johannes, 2026-11-24, textual):** «En las vistas del verificador, primero lo vamos a cambiar por Modulo de
calibración , por lo que los usuarios ya no serian verificadores si no, que serian calibradores y ponerle una leyenda que
diga algo como. Eliminar la empresa. Cambiar los listados por: Por calibrar/Calibradas. En el listado cambiaria el nombre
de la columna criterios rechazados por Qubyt por criterios rechazados. Tambien y los colores deberian ser: Azul para un
criterio rechazado por qubyt, amarillo para uno rechazado por el revisor y verde para uno rechazado por los dos. Cuando en
la revisión de una llamada se selecciona que el criterio fue rechazado, poner una X en vez de ticket y cuando es aprobado,
sacarlo de los criterios rechazados. En vez de poner por revisar en el Avance, poner Por calibrar. Añadir columna del
nombre del revisor. Luego en la vista del detalle de la llamada, eliminar el "asignada a: ti". Cambiar planilla por
revisor, entonces dejar: Veredicto Revisor: No cumple y luego Revisor: <nombre>. En las tarjetas de la revisión de
criterios, sacar el Quien tenia razón y cambiarlo por Veredicto de Calibración y dejar solo botones de cumple o no cumple
con el no cumple en rojo pastel. Dejar el agregar nota. En los criterios q coinciden con planilla cambiar la pregunta:
¿Tienen razon los dos? Por cumple o no cumple.»

## 0. Decisión final aprobada (2026-11-24)

Johannes (textual): «AB1: no pongas leyenta aún. AB2: A. AB3: No pongas eso de qubyt en duda, no queremos dar la
sensación de que qubyt se equivoca. AB4: A. AB5: Si dice ambiguo o falta información, ponlo como no cumple.»

- **AB1:** «Módulo de calibración» como título de sección en el menú lateral. **Sin leyenda** bajo las listas por ahora.
- **AB2 = A:** se renombra todo lo visible (rol «Calibrador», pestaña del admin «Calibración», calibrada/calibración en
  vez de revisada/revisión/verificación); rutas, rol interno y BD sin cambios.
- **AB3:** azul (solo Qubyt rechaza) · amarillo (solo el revisor rechaza) · verde (los dos rechazan), pastel, con leyenda
  de colores sobre la tabla. **Ningún texto «Qubyt en duda» en las vistas del calibrador.** Criterio con Qubyt sin
  veredicto (`undecided`): revisor No cumple → chip amarillo; revisor Cumple → no aparece en la columna.
  - **Decisión del diseñador (Avance):** el `undecided` con revisor Cumple **sigue siendo obligatorio** y cuenta en
    «{k} de {t} criterios». Si no, la llamada quedaría «Calibrada» con un criterio sin veredicto de nadie (dato
    incompleto). En la revisión del caso va en la lista a calibrar como cualquier otro, con «Veredicto revisor: Cumple» y
    **sin línea de Qubyt** para ese criterio (ni «Dudosa» ni «en duda»). Riesgo R-AB4: el Avance cuenta un criterio que
    no se ve como chip; aceptable, porque la columna solo lista rechazos.
- **AB4 = A:** No cumple → ✗ en el chip; Cumple → el chip sale; sin chips, «—». Acuerdo Cumple/Cumple calibrado No cumple
  → chip gris con ✗ («rechazado en la calibración»).
- **AB5:** los registros `ambiguous` / `missing_info` se **leen** como calibrados **No cumple** (chip ✗, tarjeta con No
  cumple marcado), sin migración. No hay marca «?» en ningún lado. Si el calibrador vuelve a guardar, queda el registro
  nuevo normal.

- **Ajuste posterior (2026-11-24, Johannes: «Sí, cámbialo»):** una llamada sigue en **Por calibrar** hasta que todos
  sus criterios por calibrar tienen registro; un «Qubyt se equivocó» ya no la cierra sola (antes pasaba a Calibradas con
  el primer registro en que Qubyt se equivocaba). Sin criterios por calibrar, igual que antes: «Sin observaciones» o un
  acuerdo calibrado al revés. Solo cambia la bandeja y el avance (`assignments.is_reviewed`); las métricas del admin
  (`call_status`) no cambian.

## 1. Ya decidido (no se pregunta)

| Pedido | Hoy en el código | Cambio |
|---|---|---|
| «Módulo de calibración», usuarios = calibradores | Rol `qubico_verifier`, rótulo «Verificador» (`ROLE_LABEL` en `app-shell.tsx`, `email.py`) | Rótulo visible «Calibrador»; el nombre del módulo y la leyenda en AB1 |
| Eliminar la empresa | `AdminHeader` pinta «Empresa: {clientName}» sobre el título en Por revisar, Revisadas y Resumen | Sin esa línea en las vistas del calibrador (el admin la conserva, H-AB1) |
| Listados Por calibrar / Calibradas | Menú: `Por revisar` (contador) · `Revisadas` · `Resumen`; títulos de página iguales | `Por calibrar` · `Calibradas` · `Resumen`; rutas en AB2 |
| Columna «Criterios rechazados» | «Criterios rechazados por Qubyt»: Qubyt rechaza en rojo, demás por revisar en gris (Z1) | Nombre «Criterios rechazados»; colores y contenido en AB3. El filtro se renombra igual |
| ✗ al rechazar, sacar al aprobar | ✓ = Qubyt tenía razón, ✗ = Qubyt se equivocó, ? = ambiguo (Z2) | Marca según el veredicto de calibración (AB4) |
| Avance «Por calibrar» | «Por revisar» / «{k} de {t} criterios» | «Por calibrar» / «{k} de {t} criterios» |
| Columna nombre del revisor | `Revisor` (evaluador de la planilla, `personName`) solo en Revisadas | También en Por calibrar, entre Veredicto revisor y Criterios rechazados |
| Detalle: sin «Asignada a: ti» | Línea «Asignada a: ti» para el verificador; select de reasignar para el admin | Se quita para el calibrador; el admin conserva el select. El aviso «Esta llamada está asignada a X» se mantiene |
| Planilla → revisor | «Planilla: No cumple · Evaluador de la planilla: Valeria Salinas» | `Veredicto revisor: No cumple` · `Revisor: Valeria Salinas`. «Comentario de la planilla» → `Comentario del revisor` (H-AB2) |
| Tarjeta de criterio en desacuerdo | «¿Quién tenía razón?» con 4 botones (Error de Qubyt, Error del revisor, Ambiguo, Falta información), atajos 1-4 | `Veredicto de calibración` con 2 botones: `Cumple` · `No cumple` (No cumple en rojo pastel al estar marcado), atajos 1-2; sin la ayuda de Ambiguo/Falta información. Se queda `+ Agregar nota` y «Explicación de Qubyt» al registrar |
| Criterios que coinciden | «¿Tienen razón los dos?» con Aprobar / Rechazar | `Veredicto de calibración` con `Cumple` · `No cumple`, mismo estilo |

## 2. Qué significa en datos (sin migración)

El veredicto de calibración es **el veredicto correcto del criterio**. Se traduce a los `outcome` que ya guarda
`disagreement_verifications`, así las métricas del admin (`20`, mosaico, verificación del azul) siguen igual:

| Tipo de criterio | Calibración = veredicto del revisor | Calibración ≠ veredicto del revisor |
|---|---|---|
| Desacuerdo (`fp`: Qubyt No cumple, revisor Cumple; `fn`: al revés) | `ai_error` | `reviewer_error` |
| Qubyt en duda (`undecided`) | `ai_error` («el revisor tiene razón») | `reviewer_error` |
| Coinciden (`agree`) | `both_right` | `both_wrong` |

- La tarjeta lee el `outcome` y muestra el botón que corresponde (con el veredicto del revisor del criterio).
- Sin migración y sin tocar `assignments.py`: la regla de «Calibrada» es la misma de «Revisada» (todos los criterios en
  desacuerdo con registro, o un acuerdo rechazado).
- `ambiguous` y `missing_info` ya no se pueden crear desde la tarjeta; qué pasa con los existentes es AB5.
- Backend nuevo solo para AB3: `segment_calls` hoy manda en `disagreements` solo `fp`/`fn`/`undecided`; hay que sumar los
  acuerdos en que los dos rechazan (y los `both_wrong`), con su `outcome`, y que el filtro/conteo `rejected` los incluya.

## 3. Decisiones abiertas

| # | Pregunta | Recomendada (A) | Alternativa (B) |
|---|---|---|---|
| AB1 | Dónde va «Módulo de calibración» y qué dice la leyenda (la frase quedó incompleta). | Título de sección en el menú lateral, sobre `Por calibrar · Calibradas · Resumen`, y bajo el título de cada lista la leyenda: **«Calibra cada criterio: compara lo que dijo Qubyt con lo que marcó el revisor y deja el veredicto correcto, Cumple o No cumple.»** | Leyenda más corta: «Define el veredicto correcto de los criterios en que Qubyt y el revisor no coinciden.» (o el texto que dictes) |
| AB2 | ¿Hasta dónde llega el cambio de nombre? | **Todo lo visible**: rol «Calibrador» (menú, cuentas, correo de invitación), pestaña del admin «Verificación» → «Calibración», «Revisada / Fecha de revisión / Estado de revisión de la llamada / revisadas hoy / Registrado por» → «Calibrada / Fecha de calibración / Estado de calibración de la llamada / calibradas hoy / Calibrado por». **Sin cambiar rutas ni identificadores** (`/verification`, `/verification/reviewed`, rol `qubico_verifier`): nadie ve las rutas en uso normal y no hay migración. | Igual, pero también rutas nuevas (`/calibration`, `/calibration/done`, `/calibration/summary`) con redirección desde las viejas; o solo las vistas del calibrador, dejando «Verificación» en el admin. |
| AB3 | La columna «Criterios rechazados» con azul (Qubyt), amarillo (revisor) y verde (los dos): hoy los «los dos rechazan» no están en la lista y hay dos casos sin color. | **Azul** = solo Qubyt rechaza · **amarillo** = solo el revisor rechaza · **verde** = los dos rechazan (calibrarlos es opcional, como hoy en la revisión; no cuentan en Avance). Sin color propio: **Qubyt en duda** con revisor Cumple → chip gris «Qubyt en duda» (hay que calibrarlo); con revisor No cumple → amarillo. Todos en tono pastel, con una leyenda de colores sobre la tabla y el tipo en el texto para lector de pantalla. | Solo azul, amarillo y verde; los criterios en duda con revisor Cumple no se ven en la lista (sí en el Avance y en la revisión). |
| AB4 | Marca después de calibrar. | Calibrado **No cumple** → el chip queda con **✗** (mismo color). Calibrado **Cumple** → **el chip sale** de la columna (si no queda ninguno, «—»). Un criterio en que los dos dijeron Cumple y el calibrador marcó No cumple aparece como chip gris con ✗ «rechazado en la calibración». El Avance «{k} de {t}» sigue contando todos los calibrados. | Calibrado Cumple → el chip queda atenuado y tachado en vez de desaparecer, para ver qué se aprobó. |
| AB5 | Los registros viejos con «Ambiguo» o «Falta información» (no se cuántos hay en producción; ya no se pueden crear). | **Se conservan**: la llamada sigue en Calibradas, el chip lleva «?» y la tarjeta dice «Registro anterior: Ambiguo» con `Cumple` / `No cumple` sin marcar para recalibrar si quieres. Las métricas del admin no cambian. | Se tratan como no calibrados: esas llamadas vuelven a Por calibrar y hay que elegir Cumple o No cumple. |

## 4. Supuestos y riesgos

- **H-AB1:** «Eliminar la empresa» es la línea «Empresa: …» sobre el título; solo en las vistas del calibrador.
- **H-AB2:** «Comentario de la planilla» también pasa a «Comentario del revisor» y el encabezado «Coinciden con la
  planilla» a «Coinciden con el revisor».
- **R-AB1:** azul y verde significan otra cosa en las vistas del admin (mosaico: azul = posible error del revisor, verde =
  coincide). El calibrador ya no ve el mosaico; para el admin que abre las mismas listas, la leyenda de colores sobre la
  tabla lo aclara.
- **R-AB2:** verde suele leerse como «está bien»; aquí es «los dos rechazan». Se mitiga con la leyenda y el tooltip.
- **R-AB3:** sin «Ambiguo / Falta información», los casos dudosos se fuerzan a Cumple o No cumple; la nota es el lugar
  para dejar la duda.

Trazabilidad: P-32 (el rol y el lenguaje no reflejan la tarea de calibrar el veredicto) / O-32 (veredicto de
calibración Cumple/No cumple, mismo vocabulario en listas y caso).

## 5. Especificación de implementación (aprobada)

### Backend (`src/call_audit/`)
- `verification.py`
  - Exponer en cada registro `calibration: "compliant" | "non_compliant" | null`: `correct` si existe; si no, derivado
    del `outcome` y el veredicto del revisor (tabla de §2); `ambiguous` / `missing_info` → `"non_compliant"` (AB5).
    `effective` ya traduce `correct` a `ai_error` / `reviewer_error` / `both_right` / `both_wrong`: sin cambios de
    métrica para el admin.
  - `segment_calls`: cada ítem trae, además de `fp` / `fn` / `undecided` (con `reviewerFail`), los acuerdos en que los dos
    rechazan (`kind: "both"`) y los acuerdos Cumple/Cumple con `both_wrong` (`kind: "calibrated"`), cada uno con
    `calibration`.
  - Filtro y faceta `rejected` (`rejected_by_ai` → p. ej. `rejected_criteria`): criterio `fp`, `fn`, `both` o `undecided`
    con revisor No cumple. `rejectedCounts` con la misma regla.
  - Avance y «Calibrada»: sin cambios (`TO_VERIFY = fn, fp, undecided`; `call_status` igual). `both` es opcional.
- `api/routes_admin.py` (registrar verificación): aceptar `verdict: Literal["compliant","non_compliant"]` y guardar
  `correct = verdict` con el `outcome` derivado; el `outcome` directo queda solo para compatibilidad del admin si lo usa.
- `notify/email.py`: `"qubico_verifier": "Calibrador"`. `admin.py`: textos de ayuda «verificador» → «calibrador».

### Front (`frontend/src/`)
- `components/shell/app-shell.tsx`: `ROLE_LABEL.qubico_verifier = "Calibrador"`.
- `components/shell/sidebar-nav.tsx`: para el calibrador, sección «Módulo de calibración» con `Por calibrar` (contador)
  · `Calibradas` · `Resumen`. Mismas rutas.
- `components/admin/admin-header.tsx`: no pintar «Empresa: …» si `user.role === "qubico_verifier"`.
- `lib/api/mock/data.ts`: usuario demo «Calibrador (demo)» y mocks con `calibration` / kinds nuevos.
- `lib/api/admin-types.ts`: `SegmentDisagreement.kind` suma `"both" | "calibrated"`, campos `reviewerFail` y
  `calibration`; idem en el registro de `CaseComparisonCriterion.verification`.
- `app/(app)/verification/tray-view.tsx`
  - Títulos `Por calibrar` / `Calibradas`; descripciones «Tus llamadas asignadas que faltan por calibrar…» / «Las
    llamadas que ya calibraste, la más reciente primero…»; contador «{n} pendientes · {n} calibradas hoy»; vacíos
    «¡Listo! Calibraste tus {n} llamadas.» / «Aún no has calibrado llamadas.»; botones «Ver calibradas» / «Ir a Por
    calibrar»; «Puede que ya esté calibrada. Buscar en Calibradas».
  - Columnas Por calibrar: `ID llamada` · `Fecha llamada` · `Veredicto Qubyt` · `Veredicto revisor` · `Revisor` ·
    `Criterios rechazados` · `Avance`. Calibradas: igual, sin Avance y con `Fecha de calibración` al final
    (`SORT_LABEL.reviewed`).
  - `progressLabel`: «Por calibrar» o «{k} de {t} criterios».
  - `CriteriaCell`: `fp` azul, `fn` amarillo, `undecided` con revisor No cumple amarillo, `both` verde, `calibrated`
    gris. Ocultar `undecided` con revisor Cumple. `calibration === "compliant"` → no se pinta; `"non_compliant"` → «✗».
    Orden azul, amarillo, verde, gris. `title` y sr-only: «lo rechaza Qubyt / lo rechaza el revisor / lo rechazan los
    dos / rechazado en la calibración» + «calibrado No cumple» o «sin calibrar». Nunca «Qubyt en duda».
  - Leyenda de colores sobre la tabla (una línea: azul Qubyt · amarillo revisor · verde los dos).
  - Filtro «Criterios rechazados:» con `rejectedCounts`.
- `components/admin/badges.tsx` / `globals.css`: chips pastel `chip-blue`, `chip-yellow`, `chip-green` (gris =
  `chip-muted`), borde sólido, texto con contraste ≥ 4,5:1. Botón No cumple marcado en rojo pastel.
- `components/admin/verification-labels.ts`: `CALIBRATION = { compliant: "Cumple", non_compliant: "No cumple" }`;
  `outcomeLabel` queda solo para las vistas del admin.
- `app/(app)/admin/prompts/[version]/calls/[caseId]/case-review.tsx`
  - Tarjeta de la llamada: sin «Asignada a: ti» para el calibrador (el admin conserva el select). `Veredicto revisor:
    {veredicto}` · `Revisor: {personName(evaluator)}`. «Comentario del revisor: «…»» / «El revisor no dejó comentario.».
    «Estado de calibración de la llamada: Por calibrar | {k} de {t} criterios calibrados | Calibrada». `listLabel` Por
    calibrar / Calibradas. Aviso: «Esta llamada está asignada a X. Puedes verla, pero no calibrar.».
  - Criterio a calibrar: grupo `Veredicto de calibración` (sin la ayuda de Ambiguo/Falta información), botones `Cumple`
    · `No cumple` (atajos 1, 2), seleccionado = `calibration`, No cumple marcado en rojo pastel. Se mantiene
    `+ Agregar nota` / `Guardar nota`. Lectura: «Calibrado por {by} el {fecha}: Cumple | No cumple». Sin «posible error
    del revisor»; en `undecided`, sin línea de Qubyt.
  - Acuerdos: encabezado «Coinciden con el revisor ({n} criterios) · opcional»; tarjeta con `Veredicto de calibración`
    Cumple / No cumple; estado «Calibrado: Cumple | No cumple»; ayuda «No es obligatorio calibrarlos.».
  - Toast «Calibrado: C{n} · Cumple | No cumple.». «La IA y la planilla coinciden…» → «Qubyt y el revisor coinciden en
    todos los criterios…»; «la planilla» → «el revisor» en lo que ve el calibrador.
- `app/(app)/verification/summary/page.tsx`: «Calibradas» / «Por calibrar», «Ver calibradas», «…en la calibración de la
  corrida completa».
- Admin (AB2): `verification-view.tsx` título `Calibración · v{n}`, «Verificadores» → «Calibradores», «rol Verificador» →
  «rol Calibrador», columna «Calibrador»; `prompt-version.tsx` pestaña «Calibración»; `calls-list.tsx` «Volver a
  Calibración» y columna «Calibración»; `ai-quality.tsx` «…está en Calibración»; `agreement-charts.tsx` «Calibración
  completa» / «Calibración del posible error del revisor».

### Fuera de alcance
Rutas `/verification…`, rol `qubico_verifier`, tablas y parámetros de URL/API existentes; leyenda de las listas (AB1);
migración de registros viejos (AB5).

## 6. Cambio menor: veredictos de Qubyt y del revisor en la misma línea (2026-11-24)

**Pedido (Johannes, textual):** «en la vista del calibrador, en las tarjetas de los criterios pon el resultado del
veredicto de qubyt y el del revisor a la misma altura y en vez de decir Veredicto revisor, que salga el nombre del
revisor y si cumple o no cumple.»

Revisión rápida (un gate, sin reabrir fases): toca solo `CriterionEvidence` en `case-review.tsx`, compartido por los
desacuerdos (`CriterionCard`) y los acuerdos (`AgreeCriterion`).

| Decisión | Resuelto |
|---|---|
| AE1 Disposición | Una sola línea al inicio de la tarjeta, `flex flex-wrap items-center gap-x-4 gap-y-1` (mismo patrón que la cabecera de la llamada): `Qubyt: <badge>` · `<Nombre del revisor>: <badge Cumple/No cumple>`. Se elimina la línea «Veredicto revisor» del final. Citas, motivos sugeridos y comentario de Qubyt quedan debajo, sin cambios. El admin sigue viendo `Qubyt v{n}`. |
| AE2 Sin nombre | Si la llamada no tiene evaluador: `Revisor: <badge>` (mismo término que la cabecera; no «Veredicto revisor»). |
| AE3 Qubyt sin veredicto (`undecided`) | La línea muestra solo la parte del revisor (sigue AB3/R-AB4: nada que sugiera Qubyt en duda). |

Alcance: la cabecera de la llamada se mantiene como está (`Veredicto revisor: …` · `Revisor: <nombre>`), porque ahí
queda establecido quién es la persona; el pedido es solo para las tarjetas de criterio.

Implementación: `CriterionEvidence` recibe el nombre ya formateado (`personName(cmp.reviewer.evaluator)` o `null`) desde
`CriterionCard` y `AgreeCriterion`. Badge del revisor sin cambios (`vt vt-fail` / `vt vt-pass`, textos «No cumple» /
«Cumple»). Accesibilidad: el texto del nombre y el del veredicto siguen siendo texto (no solo color); con `wrap`, en
ancho angosto la parte del revisor baja a la segunda línea sin cortar la etiqueta de su badge (envolver cada par en un
`<span>` con `whitespace-nowrap` en la etiqueta). Riesgo menor R-AE1: un nombre muy largo empuja el par a otra línea;
aceptable.

**AE4 (mismo gate). Pedido (Johannes, textual):** «Necesito también que borres la parte de la explicación de qubyt, no
se debería mostrar eso.» Se quita de `CriterionCard` el bloque «Según Qubyt: <título>. <explicación> Causa: …» / «Qubyt
no agrupó este desacuerdo en un patrón», el aviso «Explicación de Qubyt: se muestra al calibrar… Mostrar explicación
ahora» y el sufijo «· con la explicación a la vista» de «Calibrado por». `seenFirst` se guarda siempre `false`: el
calibrador ya nunca ve la explicación, así que el dato sigue siendo verdadero. Sin conflicto con decisiones previas
(refuerza AB3: nada que sugiera que Qubyt se equivoca).

**AE5 (mismo gate, vista Resumen; detalle en `22`).** Pedido (Johannes, textual): «finalmente en la vista resumen, la columna evaluados cámbiala por total y ponla al final.» Columnas: Criterio · Cumple ·
No cumple · [barra] · Total (derecha, ordenable). Mismo dato que «Evaluados» (AA2).

**AE6 (mismo gate; detalle en `22`).** Pedido (Johannes, textual): «aquí agrega el nombre del calibrador en vez de poner Mí» «Asignadas a: [<nombre> | Todas]» con
`personName` del usuario logueado (fallback «Mí»), en el Resumen y, por coherencia, en la lista del calibrador
(`verification-view.tsx`, `isVerifier`).

**AE7-AE10 (mismo gate; detalle en `22`).** Pedido (Johannes, textual): «Abajo del logo de qubyt poner -> "Auditoria inteligente de llamadas" en el navbar. Cambiar iconos del navbar por iconos que hagan más sentido con por calibrar, y calibradas. (quizás invertir los iconos) renombrar tabla de la página resumen que se llama "Por criterio" a "Ranking de criterios según tasa de no cumplimiento" Borrar los atajos de teclado y las preferencias. Deshabilitar los atajos para todas las vistas.»

- **AE7** `components/shell/sidebar-nav.tsx`: subtítulo bajo el logo «Auditoría inteligente de llamadas» (con tilde), todos los roles.
- **AE8** íconos lucide del calibrador: Por calibrar = `ClipboardList` (por hacer), Calibradas = `ClipboardCheck` (hecho). Mismo
  objeto con y sin check: el par se lee como estado de una misma tarea, más claro que `ListChecks`. Resumen sigue `BarChart3`.
- **AE9** `verification/summary/page.tsx`: título de la tabla «Ranking de criterios según tasa de no cumplimiento». Se borra
  el subtítulo «Ordenado por % No cumple, de mayor a menor» (redundante); el orden sigue indicado en la cabecera con `aria-sort`.
- **AE10** fuera «Atajos de teclado» y «Preferencias» del menú (todos los roles), la página `/settings`, el diálogo de atajos y
  el «?» global. Se desactivan todos los atajos de teclado (calibrador, detalle de llamada incl. flechas ←/→ del audio,
  patrones) con `SHORTCUTS_ENABLED=false` (reversible); se ocultan los `<Kbd>` y el checkbox «atajos» del caso. La
  `welcome-card` (cola del auditor) se elimina: su único contenido eran atajos. Se mantienen Enter en filas enfocadas y
  flechas en tablist/segmented (teclado nativo, WCAG 2.1.1). La velocidad del audio queda en 1,5x por defecto y se sigue
  cambiando desde el reproductor. Nota: quitar atajos de una tecla también cumple WCAG 2.1.4.

## 7. Cambio menor AE11-AE23: Supervisor 2, títulos, Veredicto final, login y calibración compartida (2026-11-24)

Pedido de Johannes (2026-11-24), recibido vía coordinador en 13 puntos; se registra cada punto con su ID.

| ID | Punto | Resuelto (diseñador) |
|---|---|---|
| AE11 | Rol «Supervisor 2» | Clave interna `qubico_verifier` sin migración. El admin ve «Supervisor 2» (Cuentas, selector de rol, textos de asignación: «Calibradores» → «Supervisores 2», «Calibrador» → «Supervisor 2»). El propio usuario ve «Supervisor» en su perfil del menú. Riesgo R-AE2: en el admin conviven «Supervisor» (rol `supervisor`) y «Supervisor 2»; se distinguen siempre por el «2» en toda vista del admin. |
| AE12 | Títulos | h1 «Llamadas por calibrar» / «Llamadas calibradas». El menú queda «Por calibrar» / «Calibradas». |
| AE13 | Leyenda de Calibradas | «Listado de llamadas ya calibradas ordenadas desde la más reciente. Si desea corregir un registro, abra la llamada.» |
| AE14 | Leyenda de la ✗ | «No cumple confirmado» en las dos tablas. |
| AE15 | Columna «Veredicto final» en Calibradas | Cumple / No cumple. No cumple si algún criterio comparado queda No cumple tras la calibración: registro del calibrador; si no hay registro (acuerdo sin calibrar), el veredicto coincidente Qubyt = revisor. `ambiguous`/`missing_info` viejos = No cumple (AB5). Si no, Cumple. Badge igual a los otros veredictos (rojo pastel / verde pastel, con texto). Ordenable y filtrable como los otros veredictos. |
| AE16 | «Veredicto revisor» → «Veredicto Revisor» | En toda la app (columnas, filtros, cabecera del caso). |
| AE17 | Columna «Revisor» → «Nombre Revisor» | En Por calibrar y Calibradas. El fallback de AE2 en las tarjetas («Revisor: <badge>») no cambia. |
| AE18 | Nota de orden | «Ordenado por fecha de calibración, descendente» / «Orden aleatorio fijo» pasa a quedar entre la leyenda de criterios rechazados y el filtro de ID de llamada. |
| AE19 | Separación de filtros | Cada filtro en su propio grupo (etiqueta arriba + control), `gap-x-6 gap-y-3`, con wrap; sin bordes nuevos. |
| AE20 | Acuerdos en la vista de llamada | «· opcional» → «· Calibración opcional». |
| AE21 | Login | Logo animado en loop continuo, suave; con `prefers-reduced-motion: reduce` queda quieto (WCAG 2.3.3/2.2.2, riesgo menor R-AE3: no hay botón de pausa). Se quitan los links Privacidad / Términos de uso / Cookies. «Auditoría inteligente de llamadas» (igual que AE7). Frase en tres líneas: «Cada llamada, revisada.» / «Cada hallazgo, trazable.» / «Cada decisión, humana.» |
| AE22 | Asignar las mismas llamadas a más de un Supervisor 2 | **Abierta: pregunta a Johannes.** Recomendación A (calibración compartida): un solo registro por criterio, cualquiera de los asignados puede calibrar o corregir el del otro, se muestra «Calibrado por <nombre>», y la llamada queda calibrada para todos al completarse. Admin: el diálogo «Asignar llamadas» admite varios destinatarios («Compartir con»); la columna de asignados muestra los nombres juntos. El Resumen del Supervisor 2 suma al selector de AE6 una opción por cada compañero con llamadas compartidas, para ver su avance. |
| AE23 | Dejar en 0 las calibraciones de la v3.1 en producción | Sin UI; tarea de datos del coordinador. |

**AE22 cerrada (2026-11-24):** Johannes no respondió y el coordinador sigue con lo recomendado. Queda A, calibración compartida: un registro por criterio, editable por cualquiera de los asignados, con «Calibrado por <nombre>». El selector «Asignadas a» agrega una opción por cada compañero. «Asignar llamadas» acepta varios destinatarios. Queda como supuesto H-AE1, a validar con Johannes.

**AE24 (2026-11-24).** Pedido (Johannes, textual): «dame la opción de borrar usuarios en admin para poder después crearlos de nuevo con otro rol». Aprobado así:
- **Acción:** «Eliminar» por fila en Cuentas, con un diálogo de confirmación.
- **Título del diálogo:** «¿Eliminar a <nombre>?».
- **Texto:** «Su historial (calibraciones, revisiones, registro de actividad) se conserva con su nombre. Sus llamadas pendientes vuelven a Sin asignar. Podrás crear otra cuenta con el mismo correo.».
- **Botones:** «Eliminar cuenta», en rojo pastel, y «Cancelar», con el foco inicial en Cancelar.
- **Técnico:** soft delete (status `deleted`). El correo queda libre y la cuenta sale de la lista y de los selectores. Sus sesiones activas se cierran.
- **Asignaciones:** solo se quitan las pendientes. Si una llamada estaba compartida (AE22), sigue con el otro asignado; si no, vuelve a Sin asignar. Lo ya calibrado no cambia.
- **Límites:** el admin no puede eliminarse a sí mismo, ni eliminar al último admin. En esos casos la acción aparece deshabilitada, con un tooltip que explica por qué.
- **Bitácora:** se registra la eliminación.

**AE22b (2026-11-24).** Pedido (Johannes, textual): «¿cómo asigno a los 3 las 1100 llamadas?».
- **Selector «Desde»:** con «Las mismas llamadas para todos» marcada, suma como primera opción «Todas las llamadas (N)», elegida por defecto.
- **Asignación:** se suma a los marcados y se conservan los asignados que ya tenía la llamada, así que nadie pierde llamadas.
- **Calibradas:** se incluyen. Es una excepción consciente a AD «solo pendientes», válida solo en este modo. Las calibradas aparecen en la lista Calibradas de cada persona.
- **Cantidad:** opcional; vacía significa todas.
- **Botón:** «Compartir {n} llamadas», con n = la cantidad efectiva.
- **Resumen previo bajo el botón:** «{p} por calibrar · {c} ya calibradas».

**AE25 (2026-11-24).** Pedido (Johannes): columna «Tipo de llamada» en «Llamadas por calibrar» y «Llamadas calibradas».
- **Posición:** después de «Fecha llamada».
- **Contenido:** la tipificación del ejecutivo en texto corto, la misma de `TypificationLine`. Si no hay, «—».
- **Orden y filtro:** no se ordena ni se filtra.
- **Ancho:** máximo ~220 px, con corte en una línea (`truncate`). El texto completo va en `title`, así que la tabla no se ensancha.

**AE26 (2026-11-24).** Pedido (Johannes, textual): «agregar también filtro de revisor». Se interpreta como un filtro por la columna «Nombre Revisor».
- **Control:** grupo «Nombre Revisor» con un select. Primera opción «Todos · {n} llamadas»; luego cada nombre (`personName`) con su conteo, en orden alfabético. Al final, «Sin revisor · {n}» si hay llamadas sin evaluador.
- **Posición:** después de «Veredicto Revisor».
- **URL:** `?nombre_revisor=` guarda la clave del evaluador tal como viene en los datos, no el nombre formateado.
- **Dónde se aplica:** en el cliente, si la bandeja carga todas sus filas; si está paginada, en el servidor.
- **Quitar filtros:** lo incluye.
