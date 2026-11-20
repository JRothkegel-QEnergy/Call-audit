# 18 · Bandeja y revisadas del verificador (revisión rápida, 2026-11-20)

Cambio menor sobre `13-rol-verificador-asignacion.md` (V2, V3) y `16-lista-verificador-por-motivo.md` (L1, L2). Un
solo gate: decisiones W1-W6 (W6 sumada el 2026-11-20 por pedido de Johannes). Sin código de UI hasta que se aprueben. Legal y anonimización omitidos por instrucción de
Johannes. En el front la IA se llama Qubyt; el verificador no ve el modelo (ya se cumple: `verification-view.tsx`
oculta `data.model` al verificador).

**Pedido (Johannes, 2026-11-20):** «Ahora necesito modificar la vista de verificador, necesito que al igual que la
vista de auditor, tenga un inbox con las llamadas asignadas y otra pestaña con las llamadas ya revisadas.»

## 1. Diagnóstico

**Lo que el verificador tiene hoy**

- Menú con un solo ítem, «Verificación» (`sidebar-nav.tsx`), sin contador. `/verification` redirige a
  `/admin/prompts/{v}/verification` de la versión con la última corrida completa (`getVerificationHome`).
- Esa página es **analítica**: tarjeta «Te quedan {d} de {n} llamadas» con `Ver mis llamadas` y `Seguir revisando`,
  filtro `Asignadas a: Mí · Todas`, link «Ver mis {n} llamadas ›» y el mosaico de acuerdo.
- La lista de trabajo existe, pero un nivel más abajo: `/admin/prompts/{v}/calls?segment=all&fuente=full&asignadas=me`
  (`calls-list.tsx`). Mezcla pendientes y revisadas; se separan con el filtro de estado (Todas · Pendientes ·
  Confirmadas · Qubyt se equivocó · No concluyentes). Orden aleatorio fijo; filtro por criterio con conteos (16 L2).
- La revisión del caso (`case-review.tsx`) tiene `Volver a la lista`, `Anterior` y `Siguiente`, que recorren la lista
  de origen.

**Lo que tiene el auditor (modelo a imitar)**

- Dos ítems de menú: **«Cola»** (con contador de pendientes, es su inicio) y **«Mis revisiones»** (con contador de
  reabiertas). Cada uno abre directo una tabla de trabajo, sin pasos intermedios.
- Cola: título, contador «{n} pendientes · {r} revisados hoy», botón primario `Tomar siguiente`, búsqueda por llamada,
  filtros, fin de jornada cuando no queda nada.
- Mis revisiones: lo ya enviado, búsqueda por llamada, estado y «Tu decisión», se abre para editar.

**Brecha (P-23)**

1. El verificador llega a un mosaico, no a su trabajo: la lista está a dos clics y escondida bajo `/admin/...`.
2. No hay una vista de **solo lo revisado**: hay que combinar tres filtros de estado, y no existe «Sin observaciones»
   como filtro (la lista lo muestra en la columna, pero el filtro de estado no lo separa).
3. No se sabe **cuándo** se revisó cada llamada: `SegmentCall` solo trae `reviewedAt` para «Sin observaciones»; la
   fecha de los registros por criterio (`DisagreementVerification.decided_at`) no llega al front. Sin eso no hay
   «revisadas hoy» ni orden por más reciente.
4. Sin contador en el menú: `NavCountsProvider` no calcula nada para `qubico_verifier`.

**Oportunidad O-23:** dar al verificador el mismo esquema que al auditor (bandeja como inicio + revisadas), reutilizando
la lista y la revisión del caso que ya existen, sin tocar las reglas de 13 (qué es «revisada», V9 corregir lo propio).

## 2. Decisiones

| # | Pregunta | Recomendada (A) | Alternativa (B) |
|---|---|---|---|
| W1 | ¿Cómo se organiza la navegación? | **Igual que el auditor: ítems de menú.** `Por revisar` (contador de pendientes, es el inicio), `Revisadas` y, al final, `Resumen` (la página actual: tarjeta, `Asignadas a: Mí · Todas` y mosaico, sin cambios). Las URLs dejan de mostrar `/admin/...`: `/verification` (Por revisar), `/verification/revisadas` y `/verification/resumen`. | Pestañas `Por revisar · Revisadas · Resumen` dentro de la página «Verificación» actual, con un solo ítem de menú. |
| W2 | ¿Qué llamada va en cada pestaña? | Las reglas de 13 sin cambios. **Por revisar:** asignadas a ti y no revisadas, incluidas las **a medias** (algún criterio registrado, otros no), con la columna «Avance: 1 de 3 criterios». **Revisadas:** asignadas a ti con todos sus criterios registrados o marcadas `Sin observaciones`. Una llamada pasa de una a otra al registrar el último criterio. | Las a medias van en Revisadas con la etiqueta «Incompleta». |
| W3 | ¿Cómo se ordena y filtra «Por revisar»? | **Orden aleatorio fijo** (el de hoy, el mismo para todos; mantiene la muestra sin sesgo, 13 V8) con «Ordenar por llamada» como hoy. Botón primario `Seguir revisando` (= `Tomar siguiente` del auditor). Filtro por criterio con conteos (16 L2) y búsqueda por N° de llamada. Sin filtro de estado (todas están pendientes). | Orden por fecha de la llamada (más antigua primero), como la cola del auditor. |
| W4 | ¿Qué muestra «Revisadas»? | **La más reciente primero**, con columna «Revisada el» (fecha y hora del último registro). Columnas: Llamada · Fecha · Qubyt · Planilla · Criterios (chips con ✓) · Resultado (Confirmada / Qubyt se equivocó / No concluyente / Sin observaciones) · Revisada el. Filtros: Resultado, Criterio y búsqueda por llamada. Clic abre la revisión del caso para corregir lo propio (13 V9). Requiere backend: `lastReviewedAt` por llamada. | Mismo orden aleatorio fijo de la bandeja, sin fecha de revisión (no toca backend). |
| W6 | Filtro por discrepancias (pedido de Johannes, 2026-11-20: «incluye filtro por discrepancias»). ¿Qué significa «discrepancia» aquí? Ver §2.1. | **Tipo de discrepancia de la llamada** (las partes del mosaico que el verificador ya conoce), en **las dos listas**. | B: lado del criterio. C: solo con/sin discrepancias. Ver §2.1. |
| W5 | ¿Cambia algo para el admin? | **No.** El admin sigue con la pestaña Verificación de la versión, su filtro `Todos · {verificador} · Sin asignar` y la tabla de avance; ya llega a la lista de cada persona desde «Pendientes». | El admin también ve `Por revisar` y `Revisadas` de cada verificador con un selector de persona. |

### 2.1 W6 · Filtro por discrepancias

**Qué existe hoy (código y datos).** «Discrepancia» puede ser tres cosas distintas, todas ya calculadas por llamada en
`verification.py` (`row["segment"]`, `row["reasonMatch"]`, `items[].kind`), sin IA nueva:

1. **Por veredicto de la llamada** (mosaico, `AgreementSegment` + `ReasonMatch` de `15`): Qubyt Sí / Revisor No
   (`promptFn`), Qubyt No / Revisor Sí (`promptFp`), Posible error del revisor (`reviewer`), Sin decisión de Qubyt
   (`undecided`) y Coincide con el revisor (`agree`), que se parte en Ambos aprueban / Mismos criterios / Desacuerdo
   parcial / Desacuerdo total en criterios.
2. **Por lado del criterio** (chips de la columna «Criterios en desacuerdo», `kind`): Solo Qubyt lo marca (`fp`), Solo
   el revisor lo marca (`fn`), Qubyt en duda (`undecided`). Una llamada puede tener varios lados a la vez.
3. **Con o sin discrepancia**: llamadas con al menos un criterio por verificar frente a las de acuerdo total (las que se
   cierran con `Sin observaciones`, 13 V1 B).

(La página «Análisis de discrepancias» del admin, con patrones de causa, es otra cosa y el verificador no la ve: no
entra en este filtro.)

**Opciones para W6**

| | Qué filtra | Opciones del select (con conteos, como el de criterio) |
|---|---|---|
| **A (recomendada)** | Tipo de discrepancia de la llamada (1), agrupado para que quepa en un select | `Todas · {n}` · `Qubyt aprueba, el revisor rechaza · {n}` · `Qubyt rechaza, el revisor aprueba · {n}` · `Qubyt en duda · {n}` · `Mismo veredicto, distintos criterios · {n}` (desacuerdo parcial + total) · `Sin discrepancias · {n}` (ambos aprueban + mismos criterios). Incluye (3) como última opción. |
| B | Lado del criterio (2); combinable con el filtro de criterio («criterio 25 · solo el revisor lo marca») | `Todos los lados` · `Solo Qubyt lo marca` · `Solo el revisor lo marca` · `Qubyt en duda` |
| C | Solo (3) | `Todas` · `Con discrepancias` · `Sin discrepancias` |

**Por qué A:** usa los nombres del mosaico que el verificador ya ve en Resumen, cubre también (3), y responde a cómo
trabajan (por ejemplo, barrer primero las «Qubyt aprueba, el revisor rechaza»). **«Posible error del revisor» no va
como opción** para no sesgar al verificador hacia «Error del revisor» (R-V1 de `13`); esas llamadas caen en la opción
de su veredicto (`Qubyt aprueba…` o `Qubyt rechaza…`), igual que en las listas `fn`/`fp` de hoy.

**Dónde aplica:** en **las dos listas** (Por revisar y Revisadas). En Por revisar sirve para ordenar el trabajo; en
Revisadas, para repasar lo hecho por tipo. Se combina con Criterio (y en Revisadas con Resultado); los conteos de cada
select se calculan sobre el alcance sin ese mismo filtro, como el de criterio (16 L2). `Siguiente` recorre la lista
filtrada.

## 3. Especificación (si se aprueba todo A)

### Backend

1. `assignments.py`: en los ítems de la corrida completa, `lastReviewedAt` por llamada = el mayor entre
   `DisagreementVerification.decided_at` de sus criterios en desacuerdo y `VerificationAssignment.reviewed_at`.
   Exponerlo en `SegmentCall` (lista `all`) y en el resumen propio.
2. `my_summary`: sumar `reviewed` y `reviewedToday` (fecha local Chile) para el contador «{p} pendientes · {r}
   revisadas hoy».
3. `segment_calls` / `case_comparison`: aceptar un filtro de bandeja `bandeja=pendientes|revisadas` (sobre
   `is_reviewed`), para que `Siguiente`, `Anterior` y «llamada i de t» recorran la pestaña de origen. En `revisadas` el
   orden es por `lastReviewedAt` desc.
4. Filtro W6: parámetro `discrepancia=fn|fp|undecided|criteria|none` en `segment_calls` y `case_comparison` (lista
   `all`), sobre `row["segment"]`/`row["reasonMatch"]`: `fn` = `promptFn` o `reviewer` con planilla rechaza; `fp` =
   `promptFp` o `reviewer` con planilla aprueba (la misma regla de `matches(…, "fn"/"fp")`); `undecided`; `criteria` =
   `agree` con `partial`/`none`; `none` = `agree` con `bothPass`/`same`. Sumar `discrepancyCounts` (sobre el alcance
   sin este filtro). Test: las cinco opciones suman el total de la lista.
5. Contador del menú: `GET /verification` (o uno nuevo liviano) devuelve `pending`; `NavCountsProvider` lo pide para
   `qubico_verifier`.
6. Tests: una llamada a medias está en pendientes; al registrar el último criterio pasa a revisadas con
   `lastReviewedAt`; `Sin observaciones` + `Deshacer` la devuelve; el verificador no ve llamadas de otro en ninguna de
   las dos.

### Frontend

1. `sidebar-nav.tsx` (rol `qubico_verifier`): `Por revisar` (`ListChecks`, contador, `match` del caso abierto desde
   ahí), `Revisadas` (`History`), `Resumen` (`BarChart3`).
2. Rutas nuevas bajo `app/(app)/verification/`: `page.tsx` (Por revisar), `revisadas/page.tsx`, `resumen/page.tsx`.
   Las tres resuelven la versión con `getVerificationHome()` y renderizan componentes existentes:
   - Por revisar y Revisadas: `CallsList` con un modo `bandeja` (fija `segment=all`, `fuente=full`, `asignadas=me`,
     oculta «Asignada a», oculta el filtro de estado en Por revisar, el bloque «Verificación» se reduce al contador y
     `Seguir revisando`; sin el link «Volver a Verificación»).
   - Resumen: `VerificationView` tal cual. `homeFor("qubico_verifier")` sigue siendo `/verification`.
3. `case-review.tsx`: `Volver a Por revisar` / `Volver a Revisadas` según origen (`bandeja` en la URL); `Siguiente`
   desde Por revisar va a la próxima pendiente.
4. `app-shell.tsx`: `/verification` ya está permitido; `VERIFIER_PATH` se mantiene para la revisión del caso y el
   Resumen.
5. La tarjeta del Resumen cambia `Ver mis llamadas` por `Ir a Por revisar`.

### Microcopy (vocabulario «criterio», como la lista actual)

- Menú: `Por revisar` · `Revisadas` · `Resumen`.
- Por revisar · título `Por revisar` · descripción `Tus llamadas asignadas que faltan por revisar. Están en un orden al
  azar fijo, el mismo para todos.` · contador `{p} pendientes · {r} revisadas hoy` · botón `Seguir revisando`.
- Columna `Avance`: `Sin empezar` · `{k} de {t} criterios` · sin desacuerdos: `Sin desacuerdos · por confirmar`.
- Por revisar vacía (todo hecho): título `¡Listo! Revisaste tus {n} llamadas.` · cuerpo `Si el admin te asigna más,
  aparecerán aquí.` · botón `Ver revisadas`.
- Sin asignación: `Todavía no tienes llamadas asignadas. Te avisaremos cuando el admin las reparta.`
- Revisadas · título `Revisadas` · descripción `Las llamadas que ya revisaste, la más reciente primero. Ábrelas para
  corregir tus registros.` · columna `Revisada el` · filtro `Resultado:` `Todos · Confirmada · Qubyt se equivocó · No
  concluyente · Sin observaciones`.
- Revisadas vacía: `Aún no has revisado llamadas.` + `Ir a Por revisar`.
- Filtro W6 (A): etiqueta `Discrepancia:` · `Todas · {n} llamadas` · `Qubyt aprueba, el revisor rechaza · {n}` ·
  `Qubyt rechaza, el revisor aprueba · {n}` · `Qubyt en duda · {n}` · `Mismo veredicto, distintos criterios · {n}` ·
  `Sin discrepancias · {n}`. Vacío: `Ninguna de tus llamadas {pendientes|revisadas} es de este tipo.` + `Quitar filtro`.
- Búsqueda sin resultado: `No tienes la llamada {id} en esta pestaña.` (Por revisar: `Puede que ya esté revisada.` +
  `Buscar en Revisadas`).
- Revisión del caso: `Volver a Por revisar` · `Volver a Revisadas`; título `Por revisar · llamada {i} de {t}`.

### Accesibilidad

- Contador del menú con texto accesible (`{p} pendientes`), no solo el número (igual que la Cola).
- Filas clicables también con teclado (`tabIndex=0` + Enter), como la Cola; hoy la lista del verificador solo tiene el
  link en la columna Llamada.
- «Avance» y «Resultado» en texto, no solo color (WCAG 1.4.1); botones con el tamaño estándar de `Button` (2.5.8).

## 4. Supuestos y riesgos

- **H-W1 [SUPUESTO]:** «pestaña» = lo que el auditor tiene como ítems del menú (Cola · Mis revisiones). Si Johannes
  piensa en pestañas dentro de una página, W1 B.
- **H-W2 [SUPUESTO]:** los verificadores usan poco el mosaico día a día; por eso baja a «Resumen» y no se elimina
  (Johannes lo pidió en 13 V2).
- **R-W1:** si el admin corre una corrida completa en otra versión, `getVerificationHome` cambia de versión: llamadas ya
  revisadas pueden volver a «Por revisar» si la nueva versión trae criterios en desacuerdo nuevos (los registros
  sirven para toda versión, H-15, pero los desacuerdos cambian). Es correcto, pero puede sorprender; se avisa en la
  descripción solo si pasa.
- **H-W3 [SUPUESTO]:** «discrepancias» = tipo de discrepancia de la llamada (W6 A). Si Johannes piensa en el lado del
  criterio o solo en con/sin, W6 B o C.
- **R-W3:** «Posible error del revisor» queda fuera del filtro (R-V1); si Johannes lo quiere como opción, se agrega
  sin costo técnico.
- **R-W2:** el orden aleatorio de la bandeja (W3 A) se ve distinto a la Cola del auditor (por gravedad y antigüedad);
  se explica en la descripción.
