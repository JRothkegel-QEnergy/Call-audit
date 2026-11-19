# Fase 8 · Alta fidelidad y handoff · Calidad del servicio

Fecha: 2026-11-17 · Estado: **pendiente de aprobación**.
Base: D-01 a D-30 (`estado.md`). Aplica C-01 a C-09 de `07-prototipado.md`. Reutiliza tokens y componentes de `docs/ux/call-audit/08-*` (D-30). Sin temas legales (D-00). No se tocó el frontend real.

**Entregable visual:** `08-prototipo-alta-fidelidad.html`. Usa los mismos datos que el prototipo de la Fase 7 (corrida v2.10 local, nombres sintéticos) y tiene controles de rol, simulación de estados, "Mostrar Ejecutivos sin volumen suficiente" y "Anotaciones".

---

## 1. Fundamentos (sin tokens nuevos)

| Uso | Token existente (`08-tokens.css`) | Nota |
|---|---|---|
| Barra y llave "Según la IA" | `--series-1` (azul, 4,42:1) | Barra sólida |
| Barra y llave "Según la planilla" | `--series-2` (óxido, 4,65:1) | Borde + rayado: no depende del color (1.4.1) |
| Chip de fuente IA | `--source-ai-fg`, `--source-ai-border` | **Ajuste:** se usa la convención existente de `SourceBadge`, con borde **punteado** para la IA y **sólido** para la planilla. En la Fase 5 estaba al revés en los chips; las barras no cambian |
| "Se marca distinto" | `--amber-100/600/800` (patrón Dudoso) | Ícono `TriangleAlert` + texto |
| "Parejo", "Explicado por los datos" | `--neutral-100/300/800` | Ícono `Info` en "Explicado…" |
| Fila "pocas llamadas" | fondo `--neutral-50`, texto sin atenuar | Mantiene el contraste |
| Cifra-enlace | `--teal-700`, foco `--ring` | Área mínima 24×24 |
| Tipografía, espaciado, radios, sombras | `--font-sans` (Archivo), `--space-*`, `--radius-md/lg/full`, `--shadow-sm` | Sin cambios |

En la implementación se agregan dos alias en `globals.css`: `--analysis-ai: var(--series-1)` y `--analysis-sheet: var(--series-2)`. No son colores nuevos.

## 2. Componentes

| Componente (nombre en código) | Dónde | Variantes y estados | Base |
|---|---|---|---|
| `SnapshotBand` | Bajo el título de todas las pestañas | Una corrida · corridas distintas (S-07, con nota) · sin planilla · con flujo único como texto (C-04) | Nuevo, `role="note"` |
| `AnalysisTabs` | Pestañas de sección | Por rol: supervisor 3 pestañas, Qubico 4 | `<nav>` con enlaces y `aria-current="page"`. **Ajuste:** las pestañas son rutas, así que se usa navegación y no `role="tablist"` |
| `AnalysisFilters` | Arriba de las tablas | Tipo de seguro · Flujo (se oculta si tiene un valor, C-04) · Motivo (en Ejecutivos) · "Quitar filtros" | `select` existentes, estado en la URL |
| `SourceChip` | Encabezados, lista de llamadas | `ai` (punteado, `Sparkles`) · `sheet` (sólido, `Building2`) | Extiende `SourceBadge` |
| `PairedBars` | Columna Diferencia | IA + planilla · solo IA (sin planilla) | Nuevo, `aria-hidden`, valor en texto |
| `CriterionStatusBadge` | Motivos, detalle | `consistent` · `divergent` · `data_explained` · `na` | `StatusBadge` |
| `MetricLink` | Toda cifra clicable | Normal · hover · foco · sin dato ("—", no enlaza) | `<a>` con `aria-label` completo ("Motivo 18: 20 % de llamadas no coinciden. Ver llamadas") |
| `DeviationText` | Ejecutivos, ficha | "+x pts sobre el equipo" · "−x pts bajo el equipo" · "Igual que el equipo" (±2) | Texto |
| `LowSampleMark` | Filas | "· pocas llamadas" + fila con fondo | Texto |
| `StatCard` | Detalle de motivo | No coinciden · IA · planilla · Diferencia | `KpiCard` existente |
| `AgentsGate` | Ejecutivos y "Ejecutivos que se desvían" | Bloqueado (estado vacío con "Ver Motivos") · habilitado | Nuevo (C-02, D-27) |
| `HelpList` | Bajo cada tabla | Lista corta con términos en negrita (C-07) | `<ul>` |
| `CallList` | `/analysis/calls`, ficha | Con columna "Evidencia de la IA" cuando hay motivo · paginado | Listas de `/reviews` |
| `OriginBanner` | `/calls/[id]` | Con y sin motivo · sin evidencia (aviso ámbar) · "Volver" a la cifra de origen (C-08) | Banner D-58 |
| `ReportView` | `/analysis/reports/[slug]` | Corrida igual o distinta (aviso) · audiencia | Markdown sin HTML crudo |
| `KappaDetails` | Evaluador | Plegado por defecto | `<details>` |
| Estados vacíos | Todas | S-01 con la última fecha procesada (C-09) · S-03 · Ejecutivos sin volumen · sin informes · no encontrado | `EmptyState`, `AsyncView` |

## 3. Pantallas

| Ruta real | En el HTML | Qué cambió desde la Fase 7 |
|---|---|---|
| `/analysis` → redirige a `/analysis/criteria` | `#/criteria` | C-01: columna **No coinciden**, primera y orden por defecto; título "En {n} motivos la IA y la planilla no coinciden en 10 % de las llamadas o más". C-04 y C-07 |
| `/analysis/criteria/[id]` | `#/criteria/18` | Cuatro `StatCard`. No coinciden también por tipo de seguro. "Ejecutivos que se desvían" respeta `AgentsGate` |
| `/analysis/agents` | `#/agents` | C-02: si hay menos de 5 ejecutivos con 10 o más llamadas, aparece el estado vacío "Todavía no hay llamadas suficientes por ejecutivo para comparar…" con "Ver Motivos" (es lo que se ve con la base local: 0 de 44) |
| `/analysis/agents/[id]` | ficha | Sin cambios de fondo |
| `/analysis/evaluators` (+ `[id]`) | `#/evaluators` | C-05: la tabla general usa "motivos por llamada, promedio" (como el Cambio 20) y el detalle "% de sus llamadas" |
| `/analysis/reports` (+ `[slug]`) | `#/reports` | Audiencia como badge |
| `/analysis/calls` | `#/calls?...` | C-07: `SourceChip` junto al título; fuente nueva `mismatch` ("La IA y la planilla no coinciden") |
| `/calls/[id]?from=…&criterion=…&t=…` | `#/call/...` | C-08: "Volver" se reconstruye con los parámetros de origen |

Responsive: escritorio (D-06 de call-audit). A menos de 760 px la sidebar se oculta y las tablas se desplazan dentro de su tarjeta, sin scroll horizontal de la página.

## 4. Handoff a desarrollo

### 4.1 Backend · foto precomputada (D-08, D-16, D-18, D-27)

**Comando** (sin IA, sin costo): `python -m call_audit.analysis.snapshot build [--period-days 90] [--reports-dir reports/analysis]`.
- Se dispara al terminar una pasada con corridas nuevas y al importar una planilla. También se puede correr a mano.
- Escribe una foto completa en una transacción. Si falla, la anterior sigue vigente (`is_current`).
- Configuración (en el comando o en settings), con valores por defecto: `U=15`, `EQUAL=2`, `LOW=10`, `MIN_AGENTS=5`, `PERIOD_DAYS=90`, `PAGE=50`, `DATA_EXPLAINED={25: "<texto>"}`.
- **Corrida (D-18):** usa la corrida vigente (`model_runs.is_current`) para todo. Si esa corrida no tiene marcas por motivo para una llamada, el bloque toma la mejor corrida que sí las tenga y la foto lo registra en `runs` (S-07).
- **Informes (D-16):** lee `*.md` con encabezado YAML (`title`, `date`, `run`, `audience: company|internal`, `slug`) y los guarda con la foto. Se rechaza el que no tenga encabezado válido.

**Tablas nuevas** (migración Alembic):

```
analysis_snapshots(id, created_at, is_current, period_from, period_to, sheet_until,
                   runs JSON, config JSON, payload JSON)          -- payload: agregados de §4.2
analysis_snapshot_calls(snapshot_id, case_id, agent_id, evaluator, insurance_type, flow,
                        ai_fails JSON, sheet_fails JSON, ai_evidence_ms JSON,
                        ai_verdict, sheet_verdict)                -- índice para /analysis/calls
analysis_reports(slug, snapshot_id, title, date, run, audience, body_md, loaded_at)
```

Los agregados se calculan para cada combinación de filtros (tipo de seguro × flujo, incluido "Todos"). Con 5 tipos y 2 flujos son 18 combinaciones, así que el `payload` se mantiene chico y nada se recalcula al leer (K-02).

**Definiciones de cálculo:** `02-ideacion.md` §4, más:
- `mismatch_pct` = llamadas donde `ai_fails ∋ m` ≠ `sheet_fails ∋ m`, sobre las llamadas con ambas fuentes.
- `insurance_type`: de `TIPO_SEGURO`. Si viene vacío, se agrupa desde el nombre del producto (pendiente P-3).

### 4.2 API (prefijo `/api/analysis`, solo lectura)

| Método y ruta | Roles | Respuesta |
|---|---|---|
| `GET /snapshot` | supervisor, qubico_admin, qubico_viewer | `AnalysisSnapshotMeta` · 404 `no_snapshot` → S-01 |
| `GET /criteria?type&flow` | ídem | `CriterionRow[]` |
| `GET /criteria/{id}?type&flow` | ídem | `CriterionDetail` |
| `GET /agents?type&flow&criterion&page` | ídem | `AgentsPage` (incluye `gate`) |
| `GET /agents/{agentId}?type&flow&criterion&all` | ídem | `AgentDetail` |
| `GET /evaluators?type&flow` | **qubico_admin, qubico_viewer** | `EvaluatorRow[]` · supervisor → **404** (no 403) |
| `GET /evaluators/{name}?type&flow` | ídem | `EvaluatorDetail` |
| `GET /reports` | todos los de arriba | `ReportMeta[]`, filtrado por audiencia según el rol |
| `GET /reports/{slug}` | ídem | `Report` · interno pedido por supervisor → 404 |
| `GET /calls?type&flow&criterion&source&agent&evaluator&page` | ídem (`evaluator` solo Qubico) | `CallsPage` (50 por página) |

Las cifras de `/calls` salen de `analysis_snapshot_calls` de la foto vigente. Nunca se consultan las corridas en vivo.

### 4.3 Tipos (TypeScript, `frontend/src/lib/api/analysis-types.ts`)

```ts
export type AnalysisSource = "ai" | "sheet" | "mismatch";
export type CriterionStatus = "consistent" | "divergent" | "data_explained" | "na";
export type ReportAudience = "company" | "internal";

export interface AnalysisSnapshotMeta {
  id: string;
  createdAt: string;            // ISO; "Datos al {fecha}"
  periodFrom: string; periodTo: string; periodDays: number;
  sheetUntil: string | null;    // null → sin planilla (S-02)
  runs: { perCall: string; perCriterion: string };  // distintas → S-07
  lastProcessedAt: string | null;                   // S-01 (C-09)
  filters: { insuranceTypes: string[]; flows: string[] };
  config: { u: number; equal: number; low: number; minAgents: number; pageSize: number };
}
export interface CriterionRow {
  criterionId: number; blockId: string;
  aiPct: number; sheetPct: number | null; gapPts: number | null;
  mismatchPct: number | null; mismatchCalls: number;
  status: CriterionStatus; dataExplainedNote: string | null;
  base: { withRun: number; evaluated: number };
}
export interface CriterionDetail extends CriterionRow {
  byInsuranceType: { insuranceType: string; calls: number; aiPct: number; sheetPct: number | null; mismatchPct: number | null; lowSample: boolean }[];
  deviatingAgents: { agentId: string; name: string; deviationPts: number }[]; // vacío si gate cerrado
}
export interface AgentRow {
  agentId: string; name: string; calls: number; evaluated: number;
  aiPct: number; sheetPct: number | null; deviationPts: number; lowSample: boolean;
}
export interface AgentsPage { gate: { open: boolean; agentsWithEnough: number; totalAgents: number }; rows: AgentRow[]; total: number; page: number }
export interface AgentDetail { agent: AgentRow; criteria: { criterionId: number; aiPct: number; sheetPct: number | null; deviationPts: number }[]; showingAll: boolean }
export interface EvaluatorRow { name: string; evaluated: number; disagreementPerCall: number; severityPerCall: number; vsTeam: number; lowSample: boolean }
export interface EvaluatorDetail { name: string; evaluated: number; criteria: { criterionId: number; disagreementPct: number; severityPts: number; kappa: number | null }[] }
export interface ReportMeta { slug: string; title: string; date: string; run: string; audience: ReportAudience }
export interface Report extends ReportMeta { bodyMd: string }
export interface AnalysisCall {
  caseId: string; callDate: string; agentName: string; insuranceType: string;
  aiVerdict: "compliant" | "non_compliant" | "uncertain"; sheetVerdict: "compliant" | "non_compliant" | null;
  evidenceSec: number | null;   // del motivo pedido; null → "sin evidencia de la IA"
}
export interface CallsPage { rows: AnalysisCall[]; total: number; page: number; pageSize: number }
```

Se agregan a `ApiClient` (`client.ts`), `http-api.ts` y al mock (`lib/api/mock`), siguiendo el patrón actual (`isRealMode`).

### 4.4 Frontend · tareas

| # | Tarea | Archivos |
|---|---|---|
| F-1 | Rutas `(app)/analysis/{criteria,criteria/[id],agents,agents/[id],evaluators,evaluators/[id],reports,reports/[slug],calls}` + `analysis/page.tsx` que redirige | nuevas |
| F-2 | Componentes de §2 en `components/analysis/` | nuevos |
| F-3 | Sidebar del supervisor: agregar "Calidad del servicio" (ícono `BarChart3`). En modo real se quitan Ejecutivos, Motivos, Auditores y **Discrepancias** (D-11). Admin y viewer: agregarla bajo "Análisis de discrepancias" | `shell/sidebar-nav.tsx` |
| F-4 | `ALLOWED`: `/analysis` para supervisor, qubico_admin y qubico_viewer; quitar `/discrepancies` de supervisor; `/agents`, `/dashboard/criteria` y `/auditors` redirigen en modo real | `shell/app-shell.tsx` |
| F-5 | `homeFor("supervisor")` → `/analysis/criteria` en modo real (D-20) | `shell/app-shell.tsx` |
| F-6 | `/calls/[id]`: leer `from`, `criterion`, `source`, `t`; `OriginBanner` y salto al minuto con `use-audio.ts` (H-18) | `calls/[id]/call-detail.tsx` |
| F-7 | **Copy "Revisor" → "Evaluador" (D-28):** cerca de 111 apariciones en 15 archivos (métricas del prompt, Calidad de la IA, verificación, `agreement-charts`, `case-grid`, `discrepancy-*`). Solo texto visible; nombres en código y comentarios sin cambios. Actualizar §8 del glosario de call-audit | ver `grep -rn "[Rr]evisor" frontend/src` |
| F-8 | Alias `--analysis-ai` / `--analysis-sheet` en `globals.css` | `app/globals.css` |
| F-9 | Mock con los datos agregados del prototipo (`07-prototipo-datos.py` genera el JSON) | `lib/api/mock` |

### 4.5 Comportamientos

- Los filtros viven en la URL (`type`, `flow`, `criterion`, `page`, `all`). Cambiar un filtro reinicia `page`. "Quitar filtros" vuelve a la ruta sin parámetros.
- Al filtrar, `role="status"` anuncia "Mostrando {n} motivos · {tipo}".
- Los datos se actualizan al recargar (D-19), sin sondeo.
- Orden por defecto: Motivos por No coinciden; Ejecutivos por desvío según la IA (los de "pocas llamadas" y el motivo 25 al final); Evaluadores por desacuerdo. Todas las columnas se pueden ordenar con `aria-sort`.
- Un enlace directo a Evaluadores o a un informe interno con rol supervisor muestra "No encontramos…" y la API responde 404.

### 4.6 Assets y licencias

| Recurso | Licencia | Nota |
|---|---|---|
| Archivo (Google Fonts) | SIL Open Font License 1.1 | Ya en uso |
| Íconos Lucide (`Sparkles`, `Building2`, `TriangleAlert`, `Info`, `BarChart3`) | ISC | Ya en uso; en el HTML van en línea solo para el prototipo |
| Imágenes o ilustraciones | — | No hay |

## 5. Accesibilidad (verificación de la alta fidelidad)

Se mantiene §5 de `05-patrones.md`. Revisado en el HTML:
- Contraste del texto ≥ 4,5:1 (`--neutral-700` sobre blanco: 6,85:1). Barras ≥ 3:1.
- Fuente, estado y desvío nunca dependen solo del color.
- Las cifras-enlace tienen `aria-label` completo.
- El foco es visible y no lo tapa ningún elemento fijo.
- Las pestañas usan `aria-current`.
- Tablas con `caption` y `scope`.
