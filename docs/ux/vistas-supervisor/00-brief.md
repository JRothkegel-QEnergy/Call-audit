# Fase 0 · Brief y encuadre · Vistas de análisis para el supervisor

Fecha: 2026-11-17 · Estado: **aprobado** (2026-11-17, Johannes: "Sí, apruebo todas"; decisiones D-01 a D-05 en `estado.md`) · Origen: reunión semanal del 16-nov-2026 (Jean Paul de Dompierre, Johannes Rothkegel, Agustín Desmadryl, Rodrigo Martínez Bocaz).
Nombre de trabajo: **Análisis de calidad** (el nombre y la ruta finales se deciden en la Fase 3).
IDs locales de este proceso: `P-xx`, `O-xx`, `R-xx`, `H-xx`, `D-xx`, `K-xx`. No chocan con los de `docs/ux/call-audit/` porque viven en esta carpeta. Cuando cito una decisión de otro proceso, lo indico (p. ej. "D-22 de call-audit").
**Legal y anonimización:** fuera de este proceso por instrucción de Johannes. No hay `registro-legal.md`.

---

## 1. Problema

La corredora hoy evalúa la calidad con un **veredicto binario por llamada** (planilla de calidad) hecho por evaluadores humanos. El análisis de Qubico muestra que esa medición es inconsistente, y el producto todavía no permite que la supervisora lo vea.

| ID | Dolencia | Evidencia |
|---|---|---|
| P-01 | Los evaluadores de la corredora tienen **sesgos evidentes y criterios dispersos**: ante situaciones parecidas marcan distinto | Conclusión del equipo, reunión 16-nov; tabla por evaluador en `/admin/discrepancies` (Cambio 20 §7) |
| P-02 | El veredicto de llamada es una **regla aritmética sobre los 33 motivos**. Mirar solo aprueba/rechaza esconde *qué* motivo falla y si el motivo mismo está mal definido | Agustín, reunión 16-nov |
| P-03 | Hay motivos con desacuerdo estructural que no son culpa del ejecutivo: el 25 (la metadata trae una fila por grabación aunque se gestionen varios seguros) y el 18 (tipificación del motivo de renuncia) | Métricas v2.10/v3.0 |
| P-04 | La supervisora no tiene dónde ver el desempeño por ejecutivo, por tipo de llamada ni por motivo con datos reales: `/agents`, el cruce motivo × ejecutivo y `/auditors` muestran "Estas estadísticas todavía no están disponibles" en modo real | Código: `UnavailableStats` en `agents/page.tsx`, `dashboard/criteria/page.tsx`, `auditors/page.tsx` |
| P-05 | El análisis más valioso (qué hacen distinto los ejecutivos con menos rechazo: guion estricto, validar información, indagar durante la carga del sistema, pedir confirmación del resumen de cierre, rechazar respuestas no válidas) existe solo como análisis hecho por fuera con Claude, sin lugar en el producto | Reunión 16-nov |
| P-06 | Calcular cruces en vivo sobre ~100.000 llamadas no escala con la arquitectura actual | Johannes, reunión 16-nov |

## 2. Objetivo de negocio

1. **Mostrar a la corredora que el producto vale más que un aprueba/rechaza**: detecta inconsistencias, sesgos de evaluadores y permite ajustar el estándar de servicio por motivo (posicionamiento de Agustín).
2. Tener algo concreto que **mostrar a Verónica en la reunión presencial** que coordina Rodrigo (resultados de discrepancias y análisis de calidad).
3. Pasar de "ajustarse al promedio inconsistente de los evaluadores" a un **referente de calidad**: el ejecutivo o evaluador con mejor calce de criterio.

## 3. Métricas de éxito (KPIs)

| ID | KPI | Meta propuesta |
|---|---|---|
| K-01 | Verónica, en la reunión presencial, identifica sin ayuda al menos un motivo defectuoso y un ejecutivo a revisar | Sí [SUPUESTO] |
| K-02 | Tiempo de carga de cualquier vista con 100.000 llamadas | < 2 s (lee precomputado, nunca recalcula) [SUPUESTO] |
| K-03 | Cada cifra muestra su fuente (IA vigente / planilla / auditor), su corrida y la fecha del cálculo | 100 % |
| K-04 | Desde cualquier cifra se llega a las llamadas que la componen | ≤ 2 clics |
| K-05 | Después de la reunión, la corredora pide seguir usando las vistas o pide una nueva | Sí [SUPUESTO] |

## 4. Alcance

**Sí (propuesta para validar; la ola la decide Johannes, pregunta 5):**

| ID | Requisito | Origen |
|---|---|---|
| R-01 | **Por ejecutivo:** comparar tasas de falla entre ejecutivos, filtradas por motivo | Vista 1 de la reunión |
| R-02 | **Por evaluador (auditor humano de la planilla):** rigor estadístico, sesgos y dispersión de criterio | Vista 2 |
| R-03 | **Por tipo de llamada** | Vista 3 (definición pendiente, pregunta 3) |
| R-04 | **Por motivo (33):** el motivo como unidad de análisis, para detectar motivos defectuosos | Vista 4, Agustín |
| R-05 | **Informes estáticos generados con Claude** fuera del producto y publicados en él (p. ej. patrones de los ejecutivos con menos rechazo) | Vista 5 |
| R-06 | **Alertas de ambigüedad:** distintos ejecutivos o evaluadores responden distinto ante situaciones equivalentes | Reunión |
| R-07 | **Referente de calidad:** destacar al ejecutivo/evaluador con mejor calce como patrón de comparación | Reunión (idea, no decisión) |
| R-08 | **Todo precomputado:** las vistas leen una "foto" del análisis (por corrida), con fecha y versión visibles; no hay consultas en vivo | Decisión acordada |
| R-09 | Cada cifra baja a la lista de llamadas y a `/calls/[id]` (componente existente, solo lectura) | HU-SUP-01/03, patrón D-58 de call-audit |

**No (en esta funcionalidad):**
- RAG o vectorización para encontrar "situaciones idénticas" (Rodrigo lo mencionó como opción futura). Si la pregunta 5 deja las alertas de ambigüedad en la primera ola, se resuelven con reglas sobre datos existentes, sin embeddings.
- Feedback al ejecutivo, estados de seguimiento y aprobación de revisiones (HU-SUP-03/04/07): ya diseñados en call-audit; no se tocan.
- Generar los informes de Claude desde la app (se generan afuera y se cargan).
- Re-correr la IA para obtener cifras nuevas: se usa lo que ya existe (v3.0 por llamada, v2.10 por motivo).
- Legal y anonimización (instrucción de Johannes).

## 5. Qué cubre hoy el producto y qué falta

| Pedido | Lo que ya existe | Brecha |
|---|---|---|
| R-01 Por ejecutivo | `/agents` y `/agents/[id]` (HU-SUP-03): lista con cumplimiento final y top 3 motivos, ficha con evolución. `/dashboard/criteria`: heatmap motivo × ejecutivo | En modo real **no muestran datos** (`UnavailableStats`). Se basan en hallazgos confirmados por auditores dentro de la app, que hoy casi no existen; no usan la IA vigente ni la planilla. No filtran por motivo |
| R-02 Por evaluador | `/admin/discrepancies`, tabla por evaluador (Cambio 20 §7): llamadas evaluadas, % No cumple, calce de llamada, motivos marcados por llamada, solo la IA / omitidos | **Solo para `qubico_admin`** y medido contra la IA. `/auditors` es otra cosa: productividad de los auditores de la app (casos/día, tiempo), sin datos en modo real. No hay medida de dispersión ni de sesgo por motivo |
| R-03 Por tipo de llamada | Nada. La metadata trae `FLUJO` y `TIPO_SEGURO` (`ingestion/customer.py`) y la tipificación trae el motivo de renuncia | Vista nueva + definir la dimensión |
| R-04 Por motivo | `/dashboard/criteria` (ranking de incumplimientos, sin datos reales en el cruce), Calidad de la IA en `/admin/stats` (calce IA vs planilla por motivo, solo admin), Análisis de discrepancias por motivo (solo admin) | Falta la mirada "¿este motivo está bien definido?": desacuerdo entre fuentes, dispersión entre evaluadores, peso del motivo en el veredicto. Visible para la supervisora |
| R-05 Informes de Claude | Nada. El precedente es el informe del golden set, un Markdown fuera de la app (brief de `admin-presentation`) | Contenedor para informes publicados (formato por decidir) |
| R-06 Alertas de ambigüedad | `/alerts` existe, pero es para incumplimientos críticos y escalamientos | Tipo de alerta nuevo o vista aparte; definir "situación equivalente" |
| R-07 Referente | Nada | Decisión de producto previa (ver H-07) |
| R-08 Precomputado | Calidad de la IA y Análisis de discrepancias ya trabajan "por corrida" | Mecanismo de foto por corrida que alimente todas las vistas |
| — Supervisora como usuaria | El rol `supervisor` existe con dashboard, ejecutivos, alertas, discrepancias | **Verónica hoy entra con rol Auditor** (D-22 de call-audit: "Vero y el equipo externo entran como Auditor… no ven Discrepancias"). Hay que cambiar su rol o crear un permiso (pregunta 1) |

**Lectura:** cerca de la mitad de lo pedido son vistas que **ya existen como cascarón** (ejecutivo, motivo) y que en modo real están vacías porque dependían del flujo de revisión en la app. La otra mitad (evaluador, tipo de llamada, informes, ambigüedad) es nueva o vive hoy solo en el admin. La relación con `admin-presentation` (vista para socios, pendiente en Fase 0) es de vecindad: aquella cuenta el avance del proyecto; esta muestra la calidad del servicio de la corredora. No se fusionan, pero pueden compartir gráficos.

## 6. Datos de partida (para diseñar con cifras reales)

| Nivel | Cifra | Fuente |
|---|---|---|
| Llamada (v3.0) | Calce 57 % → **64 %** | Reunión 16-nov |
| Llamada (v3.0) | 21 % posible error del evaluador; 9,5 % IA rechaza y evaluador aprueba; 3,4 % IA aprueba y evaluador rechaza | Reunión 16-nov |
| Llamada (v3.0) | 307 aprobación mutua, 134 rechazo por el mismo motivo, 155 desacuerdo parcial, 113 desacuerdo total | Reunión 16-nov |
| Llamada (v3.0) | 630 llamadas divergentes que el equipo revisará | Reunión 16-nov |
| Motivo (v2.10) | 34.605 de 36.300 marcas coinciden en cumple | Reunión 16-nov |
| Motivo | Más desacuerdo: 25 (no tipificó todas las gestiones) y 18 (motivo de renuncia) | Reunión 16-nov |

Ojo para el diseño: las cifras por llamada son de v3.0 y las por motivo de v2.10. Mezclar corridas en una misma pantalla requiere rotularlo (R-08, K-03).

## 7. Stakeholders

| Quién | Rol | Decide |
|---|---|---|
| Johannes Rothkegel | Desarrollo, dueño del producto | **Aprueba los gates** (como en call-audit, D-04) |
| Agustín Desmadryl | Socio, posicionamiento comercial | Opina sobre el relato y qué se muestra a la corredora |
| Rodrigo Martínez Bocaz | Socio, relación con la corredora | Coordina la reunión con Verónica; fuente de su feedback |
| Jean Paul de Dompierre | Socio | Opina |
| **Verónica** | Supervisora de calidad de la corredora | **Usuaria destino**; no decide el diseño, pero su reacción en la reunión es la validación |

## 8. Restricciones

- **Plataforma:** web de escritorio, Chrome o Edge (D-06 de call-audit). Next.js en `frontend/src/app/(app)/`, con shadcn/ui, Tailwind, tokens de `docs/ux/call-audit/08-tokens.css` y componentes existentes (`PageHeader`, `AsyncView`, tablas `.tbl`, heatmap de Motivos, gráficos de `discrepancy-charts.tsx`).
- **Equipo:** un desarrollador backend-first. Preferir tablas y gráficos simples ya existentes antes que visualizaciones nuevas.
- **Escala:** diseñar para ~100.000 llamadas: todo agregado se lee de una foto precomputada; las listas de llamadas se paginan en el servidor; los filtros solo cruzan dimensiones precalculadas.
- **Sin costo de IA nuevo** para alimentar las vistas (regla de la memoria del proyecto); los informes de Claude se generan aparte, con OK de costo.
- **Plazo:** la reunión presencial con Verónica (fecha por confirmar, pregunta 5).

## 9. Mercado

Chile, una sola empresa cliente (BancoEstado Corredores de Seguros). Español chileno, trato de "tú" (H-44 de call-audit). Vocabulario de la app: ejecutivo, evaluador de la planilla, motivo, planilla de calidad, la empresa (D-71/D-72 de call-audit).

## 10. Proceso propuesto (proporcionalidad)

Es una funcionalidad nueva para un usuario nuevo (la supervisora de la empresa), así que aplica el proceso completo. Propongo comprimirlo así (lo decide Johannes):

| Fase | Propuesta |
|---|---|
| 1 Investigación | Comprimida: proto-persona de Verónica, CUJ, benchmark corto (herramientas de QA de contact center: calibración, varianza entre evaluadores). **Guion breve para que Rodrigo use la reunión presencial como entrevista** |
| 2 Ideación + 3 AI | Juntas: la AI decide si se extienden rutas o se crea una sección |
| 4 Flujos | Cortos: "de la cifra a la llamada" y "publicar un informe" |
| 5 + 6 | Juntas, reutilizando patrones y glosario de call-audit |
| 7 | Wireframe HTML con las cifras reales de §6; la reunión con Verónica sirve como test |
| 8 | Reutiliza tokens y componentes; solo agrega lo nuevo |
