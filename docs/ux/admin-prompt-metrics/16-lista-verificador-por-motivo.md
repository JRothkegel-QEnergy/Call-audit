# 16 · Lista completa del verificador con filtro por motivo (revisión rápida, 2026-11-17)

Cambio menor sobre `13-rol-verificador-asignacion.md` (V2, V3) y la lista de nivel 2 de `04`/`05`. Un solo gate:
decisiones L1-L4. Sin código de UI hasta que se aprueben. Legal y anonimización omitidos por instrucción de Johannes.

**Pedido (Johannes):** «puedes hacer también para que en la vista del revisor, pueda ver el listado total y filtrar por
motivo?». Revisor = verificador (`qubico_verifier`). Uso de hoy: 4 verificadores × ~155 llamadas de las 630 divergentes
de la corrida completa v3.0; la Weekly acordó partir por los motivos con más discrepancias (25, luego 18).

## 1. Diagnóstico: casi todo ya existe

- **La lista completa ya existe** y el verificador tiene permiso para verla: `/admin/prompts/{v}/calls?segment=all&fuente=full&asignadas=me`
  (`calls-list.tsx`; `app-shell.tsx` permite `…/(verification|calls)` al verificador). Se llega por el link chico
  «Ver todas las llamadas ›» a la derecha del filtro «Asignadas a» (`verification-view.tsx:262`). Es poco visible: el
  pedido indica que no se encontró (P-21).
- **Columnas actuales:** # · Llamada · Fecha · IA · Planilla · Tipificó · Motivos en desacuerdo (chips M{n}, ✓ si
  registrado) · Asignada a · Verificación (Pendiente / Confirmada / … / Sin observaciones / Por revisar). Filtros por
  estado (Todas · Pendientes · Confirmadas · La IA se equivocó · No concluyentes) y orden aleatorio / por llamada.
- **Ya hay un select «Motivo:»** que filtra en el servidor (`criterion`). Tres problemas:
  1. **`segment=all` + `criterion` deja fuera las dudosas de la IA.** `matches()` (`verification.py:47-49`) con
     criterio solo mira `kind in ("fp","fn")`, pero la columna «Motivos en desacuerdo» y la revisión incluyen
     `undecided` (`TO_VERIFY`). Al filtrar por motivo 25 desaparecen las llamadas donde la IA quedó dudosa en el 25
     aunque el chip M25 se vea en «Todos». Hace falta ajuste de backend.
  2. **Las opciones salen de la lista ya filtrada** (`calls-list.tsx:84-86`): al elegir un motivo, el select se reduce a
     ese motivo y a los que co-ocurren. Sin conteos y ordenado por número.
  3. **Al abrir una llamada desde la lista filtrada**, `Siguiente` ya recorre la lista filtrada (`case_comparison` con
     `criterion`), pero el foco inicial es el primer motivo sin registrar, no el filtrado.
- **Oportunidad O-21:** dar al verificador un acceso visible a su lista y un filtro por motivo con conteos, para
  trabajar por motivo (25 → 18) como acordó la Weekly, reutilizando la página existente.

## 2. Decisiones

| # | Pregunta | Recomendada (A) | Alternativa (B) |
|---|---|---|---|
| L1 | ¿Dónde va la lista? | **Reutilizar la página de lista existente** y hacerla visible: botón secundario `Ver mis llamadas` en la tarjeta «Te quedan…», al lado de `Seguir revisando`; el link chico pasa a decir «Ver mis {n} llamadas ›» (Mí) o «Ver las {n} llamadas ›» (Todas / admin). Cero componentes nuevos. | Sección nueva con la tabla dentro de la pestaña Verificación, bajo el mosaico (duplica la lista, más trabajo, pantalla más larga). |
| L2 | ¿Cómo se ve el filtro por motivo? | Select «Motivo:» con **conteos y orden por cantidad** (desc., empate por n°): `Todos los motivos · {n} llamadas`, `Motivo 25 · 48 llamadas · 31 pendientes`. Las opciones salen siempre del total del alcance (no de la lista filtrada). Incluye las **dudosas de la IA** en ese motivo (arregla el problema 1). | Orden por n° de motivo, sin conteos (lo de hoy, solo arreglando las dudosas). |
| L3 | ¿El motivo filtra lo que se ve dentro de la revisión del caso? | **No oculta nada:** se ven todos los motivos de la llamada (para quedar «revisada» hay que registrarlos todos). El **foco inicial va al motivo filtrado** si está sin registrar, y su tarjeta lleva la marca «Motivo filtrado». `Siguiente` sigue recorriendo la lista filtrada (ya funciona). «Pendiente» sigue siendo de la llamada completa. | Pendiente por motivo: con filtro, `Siguiente` salta a la próxima llamada con ese motivo sin registrar aunque queden otros motivos pendientes (barrido «solo el 25»). Requiere tocar el cálculo de pendientes en `case_comparison` y `agreement_case`. |
| L4 | ¿Lo ve también el admin? | **Sí, la misma página**, con su filtro `Todos · {verificador} · Sin asignar` (ya funciona por `asignadas`). Los conteos del select siguen al alcance elegido. | Solo el verificador. |

## 3. Especificación (si se aprueba todo A)

### Backend (`src/call_audit/verification.py`)

1. `matches()`: con `segment == "all"` y `criterion`, aceptar `kind in TO_VERIFY` (fp, fn, undecided). Las demás
   listas (lados, partes del mosaico, `disagree`, `agree*`) no cambian, así no se mueven las cifras de «Detalle por
   motivo». `case_comparison` usa `matches`, así que `Siguiente` queda coherente con la lista.
2. `segment_calls()`: si `segment == "all"`, agregar al resultado `criterionCounts: [{criterionId, calls, pending}]`,
   calculado sobre **todas** las filas del alcance (antes de aplicar `criterion`): `calls` = llamadas con ese motivo en
   `TO_VERIFY`; `pending` = de esas, las con `verification == "pending"` (estado de la llamada, igual que el chip
   «Pendientes» de la lista). Orden: `calls` desc., luego `criterionId` asc. El alcance por `assignee` ya lo aplica
   `assignments.scoped`, no hay que tocar `routes_admin.py`.
3. Test en `tests/test_verification.py`: una dudosa en el motivo X entra con `segment=all&criterion=X`; los conteos no
   cambian al pasar `criterion`; `segment=fp&criterion=X` sigue sin incluir dudosas.

### Frontend

1. `lib/api/admin-types.ts`: `SegmentCalls.criterionCounts?: { criterionId: number; calls: number; pending: number }[]`.
2. `calls-list.tsx`:
   - Opciones del select desde `criterionCounts` cuando viene; si no, el comportamiento actual.
   - En la columna «Motivos en desacuerdo», el chip del motivo filtrado va con borde y texto en negrita y `sr-only`
     «(motivo filtrado)» (no depende solo del color, WCAG 1.4.1).
   - Ocultar la columna «Asignada a» cuando `asignadas=me` (siempre diría tu nombre).
   - Estado vacío con motivo: ver microcopy. `Seguir revisando` de la tarjeta ya va a la primera pendiente de la lista
     filtrada: sin cambios.
3. `verification-view.tsx` (Overview): botón `Ver mis llamadas` (variante secundaria) junto a `Seguir revisando`, y
   también cuando ya no quedan pendientes; texto del link según alcance.
4. `case-review.tsx`: foco inicial = índice del `listCriterion` en `toVerify` si no tiene registro (o está `stale`); si
   no, lo de hoy. Marca «Motivo filtrado» (chip neutro) en el encabezado de esa `CriterionCard`.

### Microcopy

- Tarjeta: `Ver mis llamadas` (botón secundario). Link: `Ver mis {n} llamadas ›` / `Ver las {n} llamadas ›`.
- Select: etiqueta `Motivo:` · `Todos los motivos · {n} llamadas` · `Motivo {m} · {c} llamadas · {p} pendientes`
  (sin pendientes: `Motivo {m} · {c} llamadas · al día`). Singular: `1 llamada`, `1 pendiente`.
- Descripción del encabezado con filtro (ya existe, se ajusta): `{k} llamadas de {n} asignadas a ti · con desacuerdo en el motivo {m}`.
- Vacío con motivo: `Ninguna de tus llamadas tiene desacuerdo en el motivo {m}.` + `Quitar filtro` (admin/Todas:
  `Ninguna llamada de este alcance tiene desacuerdo en el motivo {m}.`).
- Revisión del caso: chip `Motivo filtrado`; el título de posición ya dice `{lista} · llamada {i} de {t} (pendientes: {p})`.

### Accesibilidad

- `select` nativo con `<label>`: navegable con teclado y lector de pantalla; los conteos van en el texto de la opción.
- El botón nuevo cumple 24 × 24 px mínimo (WCAG 2.5.8) con el tamaño estándar de `Button`.
- El foco inicial en el motivo filtrado no mueve el foco del teclado al cargar (solo el resaltado de la tarjeta, como hoy).

## 4. Supuestos y riesgos

- **H-L1 [SUPUESTO]:** Johannes no encontró el link «Ver todas las llamadas ›»; si en realidad lo vio y el problema era
  otro (p. ej. las dudosas faltantes al filtrar), L1 igual suma y no estorba.
- **H-L2 [SUPUESTO]:** al revisar por motivo, el verificador registra todos los motivos de la llamada mientras la tiene
  abierta; si no, con L3 A la llamada reaparece en `Siguiente` de otros motivos hasta completarla.
- **R-L1:** con L3 A, si alguien quiere barrer «solo el 25» en las 155, `Siguiente` lo devuelve a llamadas con el 25 ya
  registrado pero otros motivos pendientes. Si molesta en la revisión de hoy, se pasa a L3 B después.
- **R-L2:** incluir dudosas solo en `segment=all` hace que «Motivo 25» en esta lista cuente más que el motivo 25 de
  «Detalle por motivo» (que cuenta fp+fn). Es esperable: aquí se cuenta lo que hay que verificar.
