# Mosaico de acuerdo IA vs. revisor · Propuesta (Fase 1, proceso reducido)

> **Cerrada el 2026-11-11** con E1-E5 (ver `estado.md`). La lista de implementación está en §11.

- **Fecha:** 2026-11-11 · **Base:** `01-mosaico-brief.md`, decisiones D1-D5 en `estado.md`.
- **Pantalla:** Admin → Versiones del prompt → v{X} → pestaña **Prueba** (`TestTab` en `prompt-version.tsx`).
- **Trazabilidad:** P-02, P-03 → R-05..R-13.

## 0. Requisitos nuevos (por D1-D5 y el loop)

| ID | Requisito | Origen |
|---|---|---|
| R-11 | El análisis de causa corre sobre los desacuerdos de **validación** de cada versión. Sus propuestas de regla **no** aparecen en la bandeja de propuestas (`ProposalDecision` / `prompt_followup`): solo alimentan el color azul. | D1 |
| R-12 | Estados del azul: sin análisis, en curso, listo, falló. Mientras no está listo, el mosaico se muestra igual, sin azul y con aviso. | D1 |
| R-13 | La evolución compara solo métricas de **validación** (entrenamiento re-corre solo las fallidas y no es comparable). | Loop |

## 1. Ubicación y orden en la pestaña Prueba

```
Resultado contra la planilla de la corredora           ← h3 existente
Medido sobre las mismas 1.000 llamadas de validación…  ← .help existente
[Resumen en una línea]                                 ← GoalSummary existente

── A. Acuerdo con el revisor · v2.13 ──────────────  (nuevo, titular)
── B. Detalle por motivo ──────────────────────────  (nuevo)
── C. Evolución entre versiones ───────────────────  (nuevo)
── Tabla de métricas (FP/FN contra meta) ──────────  (existente, sin cambios de cálculo)
── Errores por motivo ─────────────────────────────  (existente)
```

El mosaico va arriba porque es lo que se le muestra al jefe; la tabla queda debajo como detalle con metas.

## 2. Definiciones (para el desarrollo; mutuamente excluyentes, suman 100 %)

### 2.1 Por llamada (n = llamadas de validación con planilla, sin las que tuvieron error)

| Parte | Regla | Color |
|---|---|---|
| Sin decisión de la IA | Veredicto de llamada de la IA = Dudosa (sin importar el revisor) | Gris |
| Coincide con el revisor | IA y revisor con el mismo veredicto final (Cumple / No cumple) | Verde |
| Inconsistencia del revisor (según el análisis) | Llamada en desacuerdo cuyos motivos en desacuerdo son **todos** azules (§2.2) | Azul |
| IA Sí / Revisor No | IA Cumple, revisor No cumple, y no es azul | Rojo |
| IA No / Revisor Sí | IA No cumple, revisor Cumple, y no es azul | Amarillo |

- Debe calzar con la tabla: Verde = `callMatchRate`, Gris = `callUncertainRate`, Rojo + parte azul de esa dirección = `fnCount`, Amarillo + parte azul de esa dirección = `fpCount`. Mismo conjunto de llamadas (`criterionScores`).
- Si una llamada coincide en el veredicto final pero difiere en motivos, a nivel llamada es **verde** (igual que hoy).

### 2.2 Por llamada × motivo (n = llamadas × 33)

| Parte | Regla |
|---|---|
| Sin decisión de la IA | Motivo dudoso para la IA |
| Coincide | Mismo resultado. "No aplica" de la IA cuenta como Cumple (igual que `fn` en `discrepancy_analysis.py`) |
| Azul | Desacuerdo incluido en ≥ 1 patrón y **todos** sus patrones tienen `cause = auditor` (D2) |
| Rojo | IA Cumple/No aplica, revisor No cumple, no azul (incluye `transcript`, `missing_data`, sin patrón, etc.) |
| Amarillo | IA No cumple, revisor Cumple, no azul |

### 2.3 Sin análisis listo

Rojo y amarillo se muestran **sin descontar** el azul (todo el desacuerdo cae en su dirección). El aviso lo dice (§5). Así nunca se muestra un azul que no existe.

## 3. Patrón visual

### 3.1 A · Titular por llamada: Marimekko fiel al dibujo del jefe

```
Acuerdo con el revisor · v2.12 (cifras ilustrativas)             [?]
% del total de llamadas · n = 1.000 llamadas
┌────────┬────┬─┬─────────────────────────────────────────────────┐
│ ROJO   │AZUL│G│                                                 │
│ 18 %   │ 3 %│ │                 VERDE                           │
├────────┤    │ │           Coincide con el revisor               │
│AMARILLO│    │ │                 62 %                            │
│ 15 %   │    │ │                                                 │
└────────┴────┴─┴─────────────────────────────────────────────────┘
 Prompt o criterio · 33 %   Revisor·3 %  Sin decisión 2 %   Acuerdo 62 %
```

- Las cifras son ilustrativas: v2.12 aún no tiene análisis de causa (hoy sería 20 % rojo, 16 % amarillo, 0 % azul).
- Ancho de cada columna = su %; dentro de "Prompt o criterio", el alto se reparte entre rojo (arriba) y amarillo (abajo). El área de cada bloque = su % del total.
- Alto fijo 128 px (96 px en móvil), ancho 100 % de la tarjeta. Separación de 2 px en blanco entre bloques.
- Rótulo dentro del bloque solo si cabe (ancho ≥ 56 px y alto ≥ 32 px); si no, el valor va solo en la fila de rótulos de abajo y en la leyenda. Ningún bloque mayor a 0 baja de 4 px de ancho.
- Rótulos de grupo bajo el mosaico: **Prompt o criterio · 33 %**, **Revisor · 3 %**, **Sin decisión · 2 %**, **Acuerdo · 62 %**.
- Leyenda debajo (siempre visible, en texto): color + nombre + "18 % · 180 de 1.000".

### 3.2 B · Detalle por motivo: verde como número + zoom al desacuerdo

```
Detalle por motivo                                                [?]
% del total de llamadas × motivo · n = 1.000 × 33 = 33.000
Coincide con el revisor: 97 % (32.010 de 33.000) · Sin decisión: 0,3 %

Los 2,7 % que no coinciden (890), vistos al 100 %:
┌──────────────────────┬────────────────────┬──────┐
│ ROJO 52 %            │ AMARILLO 41 %      │AZUL 7│
└──────────────────────┴────────────────────┴──────┘
 IA Sí / Revisor No 1,4 % del total · IA No / Revisor Sí 1,1 % · Revisor 0,2 %
```

- Barra horizontal al 100 % **solo con los desacuerdos** (sin verde ni gris), 32 px de alto. El rótulo "vistos al 100 %" y el borde lateral en zigzag indican que es un zoom, no la escala del total.
- Cada segmento muestra dos números: % dentro del desacuerdo (en la barra) y % del total (en la línea de abajo). El titular es el % del total, para que no se confunda con el mosaico A.

### 3.3 C · Evolución entre versiones

```
Evolución del loop (validación)          [Por llamada | Por motivo]
                 Prompt o criterio      Revisor  Sin dec.  Coincide
v2.12 vigente   ███▓▓▓░  18 %  15 %      3 %      2 %       62 %
v2.13 · esta    ██▓▓░    12 %  10 %      4 %      2 %       72 %   −11 puntos rojo+amarillo
v2.14           (sin prueba)
                Meta: rojo y amarillo → casi cero
```

- **Filas = cadena del loop (E4):** la versión base del loop (vuelta 0) y cada vuelta en orden, rotuladas **"v2.12 · base"**, **"v2.13 · vuelta 1"**, … La versión que se está mirando va resaltada (fondo `--accent`, texto "esta versión"). Las vueltas posteriores a esta versión también se muestran, para que desde cualquier vuelta se vea el loop completo. Una vuelta sin prueba de validación terminada muestra "Sin prueba de validación" en vez de barra.
- Si la versión no pertenece a ningún loop, C muestra solo esa versión y la vigente, con el texto: **"Esta versión no es parte de un loop de mejora."**
- Barra apilada horizontal al 100 % por fila, **mismo orden de colores en todas**: rojo, amarillo, azul, gris, verde. Rojo y amarillo quedan pegados a la izquierda para que su avance a cero se vea de un vistazo (alineados al mismo eje).
- Columnas de números a la derecha (tabular, alineados a la derecha). Última columna: diferencia de rojo + amarillo contra la fila anterior, con texto "mejora/empeora".
- Selector **Por llamada / Por motivo** (grupo de botones con `aria-pressed`), por defecto Por llamada. En "Por motivo" la barra muestra solo el desacuerdo al 100 % (como B) y los números van en % del total.
- Fila con análisis pendiente: barra sin azul, con la etiqueta "Causa sin analizar" y un asterisco en rojo/amarillo: "* incluye lo que el análisis podría atribuir al revisor".
- Máximo esperado: 6 filas (base + 5 vueltas). Sin scroll interno.

## 4. Colores (validados con contraste)

| Parte | Relleno | Texto encima | Contraste | Notas |
|---|---|---|---|---|
| Rojo · IA Sí / Revisor No | `--red-700` #a8322f | blanco | 6,64:1 | Ya es "Incumple" en la app |
| Amarillo · IA No / Revisor Sí | #e8b931 | `--ink-900` | 9,0:1 | Borde 1 px #8a6200 (5,49:1 vs blanco) para cumplir 1.4.11 |
| Azul · Inconsistencia del revisor | #2a6fc4 con rayado diagonal 45° (blanco al 25 %) | blanco | 5,04:1 | Rayado = "según el análisis", igual que el contorno punteado de "Según IA" en la app |
| Gris · Sin decisión | `--neutral-300` #d6dbe0 | `--ink-900` | 11,9:1 | Borde 1 px `--neutral-500` (3,15:1) |
| Verde · Coincide | #0f7a55 | blanco | 5,34:1 | Distinto del teal de acción (#0f766e) por tono; si se ve muy parecido, alternativa #2e7d32 |

- Tokens nuevos en `styles/tokens.css`: `--agree-*`, `--prompt-fn-*`, `--prompt-fp-*`, `--reviewer-*`, `--undecided-*` (nombres en inglés, como el resto).
- Entre bloques vecinos el contraste rojo/azul o verde/azul es bajo (1,1-1,3:1): se resuelve con la separación blanca de 2 px y con los rótulos en texto, no con color.

## 5. Estados

| Estado | Qué se ve |
|---|---|
| Prueba no terminada | Nada nuevo; se mantiene el texto actual de `TestTab` |
| Prueba lista, análisis **sin correr** | Mosaicos sin azul. Aviso (`.banner`): **"Aún no se analiza la causa de los desacuerdos. Rojo y amarillo incluyen lo que podría ser una inconsistencia del revisor."** + botón secundario **"Analizar causa"** (E1) |
| Análisis **en curso** | Mismo mosaico + aviso con spinner: **"Analizando la causa de {n} desacuerdos… El azul aparece al terminar."** Se refresca solo (polling igual que la prueba) |
| Análisis **falló** | Aviso `error-state`: **"No se pudo analizar la causa. Rojo y amarillo incluyen todo el desacuerdo."** + botón "Reintentar" (con costo) |
| Análisis listo, sin casos azules | Azul no aparece; la leyenda dice "Inconsistencia del revisor: 0 %" |
| Sin planilla por motivo (`criterionScores = null`) | No se muestran A, B ni C: **"Esta prueba no tiene la planilla por motivo, así que no se puede armar el mosaico."** |
| Loop con una sola vuelta probada | C muestra la base y esa vuelta |

## 6. Texto (UX writing)

### 6.1 Títulos y subtítulos

- A: **Acuerdo con el revisor · v{X}** / `.help`: **% del total de llamadas · n = {n} llamadas**
- B: **Detalle por motivo** / **% del total de llamadas × motivo · n = {n} × 33 = {n×33}**
- C: **Evolución del loop (validación)** / **Mismas {n} llamadas de validación en todas las vueltas. Meta: rojo y amarillo cerca de cero.**

### 6.2 Nombres de las partes (leyenda)

| Parte | Nombre | Línea de apoyo |
|---|---|---|
| Rojo | **IA Sí / Revisor No** | La IA dice que cumple y el revisor que no. Rechazo no detectado |
| Amarillo | **IA No / Revisor Sí** | La IA dice que no cumple y el revisor que sí. Falsa alarma |
| Grupo rojo + amarillo | **Prompt o criterio** | Desacuerdos que hay que corregir en el prompt o en el criterio |
| Azul | **Inconsistencia del revisor (según el análisis)** | La IA de análisis cree que el error está en la planilla. Sin confirmar |
| Gris | **Sin decisión de la IA** | Pasan a revisión de un auditor |
| Verde | **Coincide con el revisor** | Mismo resultado que la planilla |

### 6.3 Leyendas "?" (patrón `MetricHelp` existente)

- **Acuerdo con el revisor:** Cada llamada cae en una sola parte. El ancho de cada bloque es su porcentaje del total. Rojo y amarillo son lo que hay que corregir en el prompt o en el criterio; la meta es llevarlos cerca de cero.
- **Inconsistencia del revisor (según el análisis):** Una IA revisó cada desacuerdo y concluyó que el error está en la planilla del revisor. Es su juicio y aún no está confirmado con el call center. Solo cuenta si todos sus motivos en desacuerdo apuntan al revisor.
- **Detalle por motivo:** Cada llamada se cuenta 33 veces, una por motivo. Como casi todos los motivos coinciden, el desacuerdo se muestra aparte y ampliado para que se vea.
- **% del total vs. la tabla:** En la tabla de abajo, las falsas alarmas se miden sobre las llamadas que el revisor aprobó y los rechazos no detectados sobre las que rechazó. Aquí todo se mide sobre el total de llamadas, por eso los números son más bajos.

## 7. Accesibilidad (WCAG 2.2 AA)

- Cada gráfico es `role="img"` con `aria-label` que resume los valores ("Por llamada: 62 % coincide, 18 % IA Sí revisor No, …") **y** botón "Ver como tabla" que despliega una `<table>` con `scope` (1.1.1, 1.3.1). En C la tabla es la propia grilla de números, así que el gráfico es decorativo (`aria-hidden`).
- Ninguna parte depende solo del color: nombre y % en la leyenda; el azul además lleva rayado (1.4.1).
- Bordes y rellenos ≥ 3:1 contra la tarjeta (1.4.11); texto ≥ 4,5:1 (1.4.3).
- Selector de unidad y botones con foco visible y área ≥ 24 × 24 px (2.4.7, 2.5.8).
- Sin hover obligatorio: los valores están siempre visibles. Si se agrega tooltip al pasar el mouse, es extra.
- Móvil (≤ 640 px): A baja a 96 px de alto y los rótulos internos se ocultan; C apila número bajo la barra.

## 8. Contrato de datos que pide la UI (backend)

Por versión (en `EvaluationMetrics` o en un endpoint nuevo de la evolución), dos bloques iguales, `byCall` y `byCallCriterion`:

```
{ n, agree, undecided, promptFn, promptFp, reviewer, reviewerFn, reviewerFp,
  causeAnalysis: { status: "none" | "running" | "done" | "failed", costUsd?, finishedAt? } }
```

- Conteos (no fracciones); la UI calcula los %. `reviewerFn` / `reviewerFp` son el desglose por dirección para la tabla (D3).
- Evolución: `loop: { id, rounds: [{ round, version, parentVersion, metrics | null }] }` con los mismos bloques por vuelta (E4); `null` si la versión no es de un loop.
- Las propuestas de regla del análisis de validación se guardan aparte o marcadas para que no entren a la bandeja de propuestas (R-11).

## 9. Revisión rápida

| Chequeo | Resultado |
|---|---|
| Trazabilidad | P-02 → A, B; P-03 → C; R-05..R-13 cubiertos en §2-§8 |
| Patrones | Reusa `MetricHelp`, `.banner`, `.error-state`, `.tbl`; sin librería de gráficos (bloques con CSS/flex, la app no tiene una) |
| Glosario | "Revisor" nuevo (ver E2); "Sin decisión de la IA", "Falsa alarma", "Rechazo no detectado" se mantienen |
| Dark patterns | No aplica |

## 10. Supuestos y riesgos

- **[SUPUESTO] H-06:** el jefe lee el área del Marimekko; por si no, los % siempre van en texto.
- **Riesgo R-d:** amarillo de "falsa alarma" vs. ámbar de "Dudosa" en el resto de la app. Mitigado con gris para "Sin decisión" y nombres siempre visibles (E3).
- **Riesgo R-e:** el azul baja rojo y amarillo; si el análisis se equivoca a favor de la IA, el avance se ve mejor de lo que es. Mitigado con D2 conservador, rótulo "según el análisis" y el rayado.
- **Riesgo R-f:** una versión sin análisis se ve peor que una analizada en la evolución. Mitigado con el asterisco y "Causa sin analizar".

## 11. Lista de implementación (cerrada 2026-11-11)

### 11.1 Contrato de datos (backend → UI)

En `EvaluationMetrics` de la prueba de validación (y en `activeMetrics` de la vigente):

```ts
type AgreementBreakdown = {
  n: number;            // llamadas (byCall) o llamadas × 33 (byCallCriterion), sin las con error
  agree: number;        // verde
  undecided: number;    // gris: la IA dejó Dudosa la llamada / el motivo
  promptFn: number;     // rojo: IA Sí / Revisor No, no atribuido al revisor
  promptFp: number;     // amarillo: IA No / Revisor Sí, no atribuido al revisor
  reviewer: number;     // azul = reviewerFn + reviewerFp
  reviewerFn: number;
  reviewerFp: number;
};
type CauseAnalysis = { status: "none" | "running" | "done" | "failed"; costUsd?: number; estimatedCostUsd?: number; disagreements: number; finishedAt?: string; error?: string };
// en EvaluationMetrics:
agreement?: { byCall: AgreementBreakdown; byCallCriterion: AgreementBreakdown; causeAnalysis: CauseAnalysis } | null;
// en PromptVersionDetail:
loop?: { id: string; rounds: { round: number; version: string; parentVersion: string | null; agreement: { byCall: AgreementBreakdown; byCallCriterion: AgreementBreakdown; causeAnalysis: CauseAnalysis } | null }[] } | null;
```

- Conteos enteros; la UI calcula los %. Invariante: `agree + undecided + promptFn + promptFp + reviewer = n`.
- Con `causeAnalysis.status !== "done"`, `reviewer* = 0` y todo el desacuerdo va a `promptFn` / `promptFp`.
- Debe calzar con la tabla: `byCall.agree / n = callMatchRate`, `undecided / n = callUncertainRate`, `promptFn + reviewerFn = fnCount`, `promptFp + reviewerFp = fpCount`.
- Acción: `POST` "analizar causa" de la evaluación (pagado). Sus propuestas de regla no entran a la bandeja de propuestas (R-11).

### 11.2 Componentes (en `components/admin/`)

| Componente | Qué hace | Notas |
|---|---|---|
| `AgreementMosaic` | Bloque A: Marimekko por llamada | §3.1. Alto 128 px (96 en móvil), gaps de 2 px, rótulo interno solo si cabe (≥ 56 × 32 px), ancho mínimo 4 px. `role="img"` + `aria-label` + "Ver como tabla" |
| `DisagreementZoom` | Bloque B: verde como número + barra de desacuerdos al 100 % | §3.2. Borde en zigzag a la derecha; doble número (dentro del desacuerdo / del total) |
| `LoopEvolution` | Bloque C: filas por vuelta, barras alineadas, selector Por llamada / Por motivo | §3.3. Grupo de botones con `aria-pressed`. Barra `aria-hidden`; la grilla de números es la versión accesible |
| `AgreementLegend` | Leyenda compartida: color + nombre + "x % · a de n" | Usada en A y B |
| `CauseAnalysisNotice` | Aviso según `causeAnalysis.status` + botón "Analizar causa" | Confirmación con `Dialog` existente |
| Tokens en `styles/tokens.css` | `--agree-bg #0f7a55`, `--prompt-fn-bg var(--red-700)`, `--prompt-fp-bg #e8b931` + `--prompt-fp-border #8a6200`, `--reviewer-bg #2a6fc4` (rayado 45°, blanco 25 %), `--undecided-bg var(--neutral-300)` + `--undecided-border var(--neutral-500)` | §4 |

Orden en `TestTab`: encabezado y `GoalSummary` → `CauseAnalysisNotice` → `AgreementMosaic` → `DisagreementZoom` → `LoopEvolution` → tabla de métricas → `CriterionErrors`. Si `agreement` es `null`, en lugar de A, B y C va: "Esta prueba no tiene la planilla por motivo, así que no se puede armar el mosaico."

### 11.3 Textos exactos

**Bloque A**
- Título: `Acuerdo con el revisor · v{X}` + `MetricHelp`.
- Subtítulo: `% del total de llamadas · n = {n} llamadas`
- Rótulos de grupo: `Prompt o criterio · {a} %` · `Posible error de planilla · {b} %` · `Sin decisión · {c} %` · `Acuerdo · {d} %`

**Bloque B**
- Título: `Detalle por motivo` + `MetricHelp`.
- Subtítulo: `% del total de llamadas × motivo · n = {n} × 33 = {n×33}`
- Línea: `Coincide con el revisor: {p} % ({agree} de {n}) · Sin decisión: {u} %`
- Sobre la barra: `Los {x} % que no coinciden ({k}), vistos al 100 %:`
- Bajo la barra (rótulos con muestra de color): `IA Sí / Revisor No · {r} % del total` · `IA No / Revisor Sí · {y} % del total` · `Posible error de planilla · {z} % del total`
- Línea de apoyo bajo los rótulos (`.help`, solo si el azul > 0): `Posible error de planilla: una IA revisó estos desacuerdos y cree que se equivocó el revisor, no el prompt. Aún sin confirmar.`

**Bloque C**
- Título: `Evolución del loop (validación)`; selector: `Por llamada` / `Por motivo`.
- Subtítulo: `Mismas {n} llamadas de validación en todas las vueltas. Meta: rojo y amarillo cerca de cero.`
- Filas: `v{X} · base`, `v{X} · vuelta {N}`, marca `esta versión`.
- Columnas: `IA Sí / Revisor No` · `IA No / Revisor Sí` · `Posible error de planilla` · `Sin decisión` · `Coincide` · `Cambio`. (El encabezado del azul puede partir en dos líneas, igual que los de rojo y amarillo; no abreviar.)
- Cambio: `−{d} puntos rojo + amarillo · mejora` / `+{d} puntos rojo + amarillo · empeora` / `Sin cambio` (< 1 punto).
- Vuelta sin análisis: `Causa sin analizar` y nota `* Rojo y amarillo incluyen lo que el análisis podría atribuir al revisor.`
- Vuelta sin prueba: `Sin prueba de validación`.
- Sin loop: `Esta versión no es parte de un loop de mejora.`

**Leyenda (nombre / línea de apoyo)**
- Rojo: `IA Sí / Revisor No` / `La IA dice que cumple y el revisor que no. Rechazo no detectado.`
- Amarillo: `IA No / Revisor Sí` / `La IA dice que no cumple y el revisor que sí. Falsa alarma.`
- Azul: `Posible error de planilla (según la IA de análisis)` / `La IA de análisis cree que se equivocó el revisor al llenar la planilla. Sin confirmar.`
- Gris: `Sin decisión de la IA` / `Pasan a revisión de un auditor.`
- Verde: `Coincide con el revisor` / `Mismo resultado que la planilla.`
- Formato de valor: `{p} % · {a} de {n}`.

**Avisos (`CauseAnalysisNotice`)**
- `none`: `Aún no se analiza la causa de los desacuerdos. Rojo y amarillo incluyen lo que podría ser un error de planilla.` + botón `Analizar causa`.
- Diálogo: título `¿Analizar la causa de {k} desacuerdos?`; cuerpo `Una IA revisa cada desacuerdo de validación para separar los que parecen error de la planilla. Costo estimado: US$ {e}. Sus propuestas de regla no se usan.`; botones `Analizar · US$ {e}` y `Cancelar`.
- `running`: `Analizando la causa de {k} desacuerdos… El azul aparece al terminar.`
- `failed`: `No se pudo analizar la causa. Rojo y amarillo incluyen todo el desacuerdo.` + botón `Reintentar` (abre el mismo diálogo).
- `done`: sin aviso; bajo el mosaico, `.help`: `Causa analizada el {fecha} · US$ {c}`.

**Leyendas "?"**: las de §6.3, más la del revisor: `Revisor: quien llenó la planilla de calidad de la corredora.`

**Ajuste 2026-11-11 · rótulo del azul.** "Revisor" a secas (A, B y C) e "Inconsistencia del revisor (según el análisis)" (leyenda) pasan a **Posible error de planilla** / **Posible error de planilla (según la IA de análisis)**. Motivo: el admin leyó "Revisor" junto a "IA Sí / Revisor No" y no supo qué era; en la v2.13 el azul es 59 % del desacuerdo por motivo. Arrastra: `PARTS.reviewer.name` (y con él el `aria-label` de B y la tabla "Ver como tabla"), la leyenda "?" de §6.3 (`Posible error de planilla (según la IA de análisis): una IA revisó cada desacuerdo y concluyó que se equivocó el revisor al llenar la planilla. Es su juicio y aún no está confirmado con el call center. Solo cuenta si todos sus motivos en desacuerdo apuntan a la planilla.`), y la nota de vuelta sin análisis en C: `* Rojo y amarillo incluyen lo que el análisis podría marcar como error de planilla.` Glosario: `../call-audit/06-ux-writing.md` §8 y §8.2.

**Renombres (E2)**
- `Coincide con la corredora` → `Coincide con el revisor` en la tabla de `TestTab` (`METRIC_ROWS[0].label`), en el encabezado de `admin/prompts/page.tsx` y en `components/admin/ai-quality.tsx`.
- Las leyendas de FP, FN y Coincide cambian "la corredora aprobó/rechazó" por "el revisor aprobó/rechazó".
- Discrepancias no se toca.
