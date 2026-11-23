# 20 · Ver y verificar los criterios en que Qubyt y la planilla coinciden (revisión rápida, 2026-11-23)

Cambio sobre la revisión del caso del verificador (`04`, `13`, `16`, `18`). Gate propio, aparte de `19` (otro pedido y
otra pantalla): decisiones Y1-Y5. Sin código hasta que se aprueben. Legal y anonimización omitidos por instrucción de
Johannes. En el front la IA se llama Qubyt. Retoma el punto abierto **O-V1** de `13` («si el verificador cree que la IA
**y** la planilla se equivocan, hoy no hay dónde registrarlo»).

**Pedido (Johannes, 2026-11-23):** «En la revisión, si yo aprieto coinciden con la planilla, deberia poder apretar algo
sobre cada criterio para ver el motivo por el que coincide y tambien deberia poder aprobar o rechazar.»

**Ya decidido por Johannes (no se pregunta):** cada criterio en acuerdo se puede abrir para ver por qué coincide, y se
puede aprobar o rechazar.

## 1. Diagnóstico

- **Hoy** (`case-review.tsx:442`): `<details>` «Coinciden con la planilla ({n} criterios)» con una línea por criterio:
  `Criterio N · descripción · Qubyt Cumple/No cumple`. Sin citas, comentario, ficha ni registro.
- **El dato ya llega al front:** `case_comparison` arma cada criterio en acuerdo igual que los desacuerdos (veredicto,
  `comment`, `evidence` con `startMs`, `suggestedReasons`, `reviewerFail`). Solo falta pintarlo. No hay `analysis`
  (análisis de causa) para los acuerdos y no hace falta.
- **Volumen:** las filas traen **todos** los criterios de la capa 2 más los del código, así que una llamada típica tiene
  ~25-30 criterios en acuerdo, casi todos «ambos Cumple» (sin cita, porque Qubyt no deja evidencia de lo que no
  ocurrió). Los «ambos No cumple» son pocos y sí traen cita. Esto pesa en Y3.
- **Registro:** `DisagreementVerification` es por llamada × criterio, **sin versión**, y guarda `correct` (la respuesta
  correcta: `compliant`/`non_compliant`). `effective()` traduce `correct` a «Error de Qubyt / Error del revisor»
  comparándolo con la planilla de hoy. `record()` ya acepta cualquier criterio de `verifiable_criteria()`, incluso uno
  en acuerdo, pero solo con los 4 outcomes de desacuerdo.
- **Bug latente encontrado:** si un criterio se registró como desacuerdo con otra versión y ahora coincide, la lista
  muestra «verificado: Error de Qubyt» o «Error del revisor» (`case-review.tsx:449`), que no tiene sentido en un
  acuerdo. Con este cambio se rotula bien: `correct == planilla` → «Ambos tienen razón»; si no, «Ambos se
  equivocaron».
- **Estado de la llamada** (`call_status`, `is_reviewed`) depende solo de los desacuerdos; una llamada sin desacuerdos
  se cierra con `Sin observaciones` (13 V1 B).

## 2. Decisiones

| # | Pregunta | Recomendada (A) | Alternativa (B) |
|---|---|---|---|
| Y1 | ¿Qué se ve al abrir un criterio en acuerdo? | **La misma tarjeta que un desacuerdo, en un acordeón por criterio**: veredicto de Qubyt, citas con `Escuchar desde mm:ss`, motivos de renuncia sugeridos (criterio 18), comentario de Qubyt y veredicto de la planilla; al abrirlo pasa a ser el criterio en foco, así la ficha del seguro salta a la sección que importa. La sección se parte en dos: **«Ambos No cumple» ({k})** primero y abierta por defecto (son pocos y tienen cita), y **«Ambos Cumple» ({m})** cerrada. Sin cita: «Qubyt no dejó cita: lo da por cumplido porque no lo encontró en la llamada.» | Ventana emergente (popover) con solo el comentario de Qubyt y la planilla, sin citas ni audio. |
| Y2 | ¿Qué significa «aprobar» y «rechazar»? | **`Aprobar` = Qubyt y la planilla tienen razón. `Rechazar` = los dos se equivocaron** (lo correcto era lo contrario: si ambos dicen Cumple, en realidad No cumple, y viceversa). Nota opcional, como en los desacuerdos. Se puede cambiar o deshacer (13 V9: solo lo propio; el admin, todo). | Cuatro salidas, como en los desacuerdos: `Ambos tienen razón` · `Ambos se equivocaron` · `Ambiguo` · `Falta información`. |
| Y3 | ¿Es obligatorio para dar la llamada por revisada? | **Opcional.** Un acuerdo sin marcar cuenta como aprobado de forma implícita (igual que «aceptado sin cambios» del auditor). Obligarlo serían ~25-30 clics más por llamada en ~1.100 llamadas. La regla de «revisada» de 13 no cambia. | Obligatorio: la llamada queda revisada solo cuando todos sus criterios (desacuerdos y acuerdos) tienen registro; con un botón `Aprobar todos los que coinciden`. |
| Y4 | ¿Cómo cuenta un acuerdo rechazado? | **Como error de Qubyt y de la planilla a la vez.** La llamada pasa a «Qubyt se equivocó» (igual que un `Error de Qubyt`). La línea de verificación de las listas y del Resumen suma `Ambos se equivocaron {k}`, y el filtro Resultado de Revisadas suma la opción `Ambos se equivocaron`. Un acuerdo aprobado no cambia ninguna cifra. Mosaico y métricas oficiales siguen sin cambiar (se miden contra la planilla, como hoy). | Resultado aparte por llamada, «Ambos se equivocaron», que no cuenta como «Qubyt se equivocó». |
| Y5 | ¿Cómo convive con `Sin observaciones`? | En una llamada **sin desacuerdos**: si no rechazas nada, la cierras con `Sin observaciones` (como hoy; aprobar acuerdos de forma explícita no la cierra sola). **Si rechazas un acuerdo, la llamada queda revisada sola** (ya tiene una observación) y `Sin observaciones` se reemplaza por el texto «Revisada: registraste {k} criterio(s) en que los dos se equivocaron.» Si deshaces el último rechazo, vuelve a pendiente y reaparece `Sin observaciones`. En una llamada **con desacuerdos**, nada cambia: queda revisada cuando todos los desacuerdos tienen registro. | Rechazar un acuerdo no cierra la llamada: igual hay que pulsar `Sin observaciones` (con otro nombre, `Dar por revisada`). |

## 3. Decisión técnica (no se pregunta a Johannes)

**Se guarda en `DisagreementVerification`, sin migración.** Dos outcomes nuevos, `both_right` y `both_wrong` (caben en
`String(20)`; la columna no tiene restricción CHECK), con `correct` lleno (`both_right` → la planilla; `both_wrong` →
lo contrario). Como `correct` no depende de la versión, el registro sirve igual si en otra versión ese criterio pasa a
ser desacuerdo: `effective()` ya lo traduce a «Error de Qubyt» o «Error del revisor», y al revés. Sin tabla nueva
(alternativa descartada: `AgreementVerification`, con migración y una segunda fuente de verdad por criterio).

## 4. Especificación (si se aprueba todo A)

### Backend (`src/call_audit/verification.py`; no tocar `assignments.py`, que tiene trabajo de otra sesión en curso)

1. `OUTCOMES_AGREE = ("both_right", "both_wrong")`; `correct_for` los cubre. `record()` valida el outcome según el
   `kind` del criterio en esa llamada: acuerdo → solo `OUTCOMES_AGREE`; desacuerdo → solo `OUTCOMES`; si no, `bad_outcome`.
2. `effective(record, reviewer, kind)`: para `agree`, `correct == planilla` → `both_right`, si no `both_wrong`; para
   desacuerdos, lo de hoy (un `both_*` viejo se traduce por `correct`).
3. `call_status`: recibe también los acuerdos rechazados; `both_wrong` cuenta como `ai_wrong`. Una llamada sin
   desacuerdos y con algún `both_wrong` queda `ai_wrong` (revisada) sin `Sin observaciones` (Y5 A). El cálculo de
   «revisada» en `assignments.is_reviewed` ya lee `verification != "pending"`, así que no hay que tocarlo si
   `call_status` deja de devolver `none` en ese caso (verificar al implementar; si hiciera falta tocar
   `assignments.py`, coordinarlo con la otra sesión).
4. `summarize`: contador `bothWrong` (criterios) para la línea de verificación.
5. Tests: aprobar/rechazar un acuerdo guarda `correct`; outcome cruzado (desacuerdo con `both_right`) → 400; un
   `both_wrong` en llamada sin desacuerdos la deja revisada y en «Qubyt se equivocó»; deshacerlo la devuelve a
   pendiente; un registro de desacuerdo viejo se rotula bien en un acuerdo.

### Frontend

1. `case-review.tsx`: la sección «Coinciden con la planilla» pasa a dos grupos (Y1 A), cada criterio como acordeón
   (`<details>`/`<summary>` o un `button` con `aria-expanded`) que al abrirse muestra el cuerpo de `CriterionCard`
   (extraer la parte de evidencia a un componente compartido) y el grupo `Aprobar · Rechazar` (`role="radiogroup"`).
2. Resumen de la línea cerrada: `Criterio N · descripción · Qubyt y planilla: No cumple` + estado (`Aprobado` /
   `Rechazado: los dos se equivocaron` / nada).
3. `verification-labels.ts`: rótulos de `both_right` / `both_wrong`; resultado `Ambos se equivocaron` en Revisadas.
4. Atajos de teclado: los de 1-4 siguen solo para el desacuerdo en foco; los acuerdos se marcan con clic o teclado
   sobre los botones (sin atajos nuevos).

### Microcopy

- Grupos: `Ambos No cumple ({k})` · `Ambos Cumple ({m})`; encabezado de la sección: `Coinciden con la planilla ({n}
  criterios) · opcional`.
- Ayuda bajo el encabezado: `No es obligatorio revisarlos. Si crees que Qubyt y la planilla se equivocaron en alguno,
  ábrelo y márcalo con Rechazar.`
- Pregunta del grupo: `¿Tienen razón los dos?` · botones `Aprobar` · `Rechazar`; `aria-label` `¿Tienen razón los dos?
  Criterio {N}`.
- Al rechazar: `Registrado: Qubyt y la planilla se equivocaron. Lo correcto es {Cumple|No cumple}.` + `Deshacer`.
- Sin cita: `Qubyt no dejó cita: lo da por cumplido porque no lo encontró en la llamada.`
- Llamada sin desacuerdos con rechazo: `Revisada: registraste {k} criterio(s) en que los dos se equivocaron.`
- Registro de otra versión: `Registrado por {nombre} el {fecha} desde v{x}: {Ambos tienen razón|Ambos se equivocaron}.`

### Accesibilidad

- Acordeón con `aria-expanded` y `aria-controls`; operable con Tab + Enter/Espacio.
- Estado `Aprobado`/`Rechazado` en texto en la línea cerrada (no solo color, WCAG 1.4.1).
- Botones con el tamaño estándar (WCAG 2.5.8); el foco no salta al abrir un acordeón.

## 5. Supuestos y riesgos

- **H-Y1 [SUPUESTO]:** «ver el motivo por el que coincide» = ver la evidencia y el comentario de Qubyt junto a la
  planilla (no hay un «motivo» guardado aparte para los acuerdos).
- **H-Y2 [SUPUESTO]:** los rechazos de acuerdos serán pocos; si son muchos, la planilla y Qubyt comparten un sesgo y
  conviene verlo en un análisis aparte.
- **R-Y1:** con Y3 A, «aprobado implícito» no distingue «lo revisé y está bien» de «no lo miré». Si Johannes necesita
  esa diferencia, el `Aprobar` explícito queda guardado y se puede contar.
- **R-Y2:** un `both_wrong` hace que la llamada cuente como «Qubyt se equivocó» aunque Qubyt coincidiera con la
  planilla; puede sorprender al leer las tasas de la verificación. Se mitiga con el contador aparte `Ambos se
  equivocaron`.
- **R-Y3:** Y5 A cierra la llamada al primer rechazo; si el verificador quería seguir revisando otros acuerdos, sigue
  pudiendo (la llamada queda en Revisadas y se puede abrir).
