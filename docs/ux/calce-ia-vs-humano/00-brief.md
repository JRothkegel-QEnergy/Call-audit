# Fase 0 · Brief y encuadre · Pestaña "Calce IA vs humano"

Fecha: 2026-10-20 · Estado: **pendiente de aprobación** · Herramienta interna de I+D (no es el producto Call Audit).

## 1. Problema

El dashboard local de revisión de la capa 2 (`scripts/prompt_bench/dashboard.py` + `dashboard_template.html`) compara cada modelo con el veredicto del cliente (`ESTADO_CALIDAD`), pero la información para decidir **qué modelo o combinación usar** está repartida en cuatro secciones que se solapan ("Excel vs. IA", "Comparación entre versiones del prompt", "Acuerdo entre IA", "¿Qué motivos distinguen una llamada rechazada?") y ninguna responde de forma directa:

- ¿Qué modelo calza mejor con el humano a nivel de llamada?
- ¿En qué criterios cada modelo genera falsas alarmas?
- ¿Qué NO podemos medir todavía y por qué?

Además, el mockup de referencia sugiere métricas por criterio que, con los datos actuales, serían circulares en las llamadas RECHAZADAS (el Excel no dice qué criterios se incumplieron).

## 2. Objetivo

Una pestaña que permita al equipo de Qubico elegir modelo/combinación para la capa 2 con evidencia honesta: ranking a nivel de llamada, falsas alarmas por criterio (solo en aprobadas), vista descriptiva de las rechazadas y un aviso explícito de lo que aún no se mide, preparada para sumar la detección por criterio cuando exista referencia.

## 3. Métricas de éxito (KPIs de la herramienta)

| ID | KPI | Meta propuesta [SUPUESTO] |
|---|---|---|
| K-01 | Tiempo para responder "¿qué modelo calza mejor y dónde falla?" | < 2 min leyendo solo la pestaña |
| K-02 | Interpretaciones erróneas de métricas (p. ej. leer la vista de rechazadas como aciertos) | 0 en una lectura guiada con 2 personas del equipo |
| K-03 | Secciones duplicadas entre pestañas | 0 (cada pregunta se responde en un solo lugar) |
| K-04 | Esfuerzo para sumar detección por criterio cuando haya referencia | Solo agregar datos; sin rediseñar la pestaña |

Metas de negocio ya definidas (`docs/context.md`): **≤ 5 % falsos positivos y ≤ 20 % falsos negativos** contra llamadas auditadas por el cliente. Propongo mostrarlas como líneas de referencia en el ranking (R-08), sujeto a la pregunta 2.

## 4. Alcance

**Sí (acordado con el usuario, no se reabre):**
- R-01 Ranking principal = calce a nivel de **llamada**: detección de rechazadas (IA rechaza si marca ≥1 criterio) y falsas alarmas en aprobadas.
- R-02 Tabla por criterio = **solo falsas alarmas**, calculadas sobre aprobadas (supuesto: ahí todos los criterios se cumplen; ver H-01).
- R-03 Rechazadas = vista **descriptiva**: qué criterios marca cada modelo y cuánto coinciden entre modelos; nunca como aciertos.
- R-04 Mapa de errores llamada × criterio: en rechazadas, color neutro "IA marca incumplimiento", sin verde/rojo.
- R-05 Aviso explícito de lo que no se mide (detección por criterio) y estructura lista para sumarlo (COMENTARIO mapeado a criterios o revisión Qubico de ~50 rechazadas).
- R-06 Ordenar/reemplazar las secciones existentes que se solapan en vez de duplicarlas.
- R-07 Nombres reales de modelo y color fijo por modelo (`LABELS`, `ORDER`).

**No:**
- Cambiar el prompt, los modelos ni la lógica de veredicto (`real_calls.verdict`).
- Tocar el front del producto Call Audit (`docs/ux/call-audit/`).
- Construir aún la captura de referencia por criterio (se diseña el "hueco", no el flujo de captura, salvo que se decida lo contrario en la pregunta 5).
- Publicar el dashboard fuera de localhost / canal interno.

## 5. Restricciones técnicas

- HTML autocontenido generado por Python; datos en `const D = ...`; JS vanilla sin librerías; tokens de color ya definidos en el template (claro/oscuro, paleta secuencial y divergente, `--good/--warn/--crit`). La pestaña nueva reutiliza esos tokens: no hay Fase 8 de tokens nuevos salvo necesidad.
- Datos disponibles por llamada y modelo: `verdict` (APROBADA / RECHAZADA / DUDOSA / ERROR / null), `bad` (criterios incumple), `unsure` (indeterminados), `minor_only` (REC*: solo motivos leves), costo, latencia. Por llamada: `real`, `reason`, `comment`, `holds`, `typification`.
- Matices que afectan las métricas (ver pregunta 1):
  - **DUDOSA / "por revisar"**: la IA no aprueba ni rechaza.
  - **REC\***: rechazo solo por criterios leves (`MINOR_CRITERIA`).
  - **Criterio 1 (esperas)** lo calcula el código desde `holds` (>30 s), no el modelo: es idéntico en todos los modelos.
  - **Criterios 19–25** no evaluables cuando la llamada no trae `TIPIFICACION`: el denominador por criterio cambia.
  - **ERROR / sin resultado** en algunos modelos: el denominador cambia por modelo.
  - **Versiones del prompt**: `D.versions` puede traer varias; solo la actual trae detalle completo.
- Hoy hay hasta 6 modelos en `ORDER` (el mockup muestra 4): el diseño debe escalar a 6 columnas.
- Muestra pequeña (~100 llamadas; la proporción aprobadas/rechazadas define la precisión). Diferencias de 1–3 llamadas entre modelos no son concluyentes: hay que mostrar conteos ("12 de 48"), no solo %.
- Uso en escritorio (pantalla de laptop/monitor); no se exige móvil, pero no debe romperse a 900 px (breakpoint existente).

## 6. Plazos

Sin plazo informado [SUPUESTO: días, no semanas]. Ver propuesta de alcance reducido del proceso en §10.

## 7. Plataforma

Web local (navegador de escritorio), servido por `review_server.py` en localhost; copia compartible por `share_dashboard.py` en canal interno.

## 8. Usuarios y stakeholders

| Rol | Quién | Uso |
|---|---|---|
| Decide (gates y elección de modelo) | Johannes [SUPUESTO: igual que en Call Audit, D-04] | Elegir modelo/combinación para capa 2 |
| Usuarios | Equipo interno de Qubico (I+D, producto) | Leer ranking, inspeccionar errores, revisar llamadas |
| Afectados indirectos | Cliente (BancoEstado), ejecutivos evaluados, clientes finales de las llamadas | Sus datos aparecen en el dashboard |

Proto-persona preliminar (se detalla en Fase 1 si se aprueba): **analista de I+D** que conoce la pauta de 33 criterios, corre `prompt_bench`, alterna entre ver agregados y escuchar llamadas puntuales en "Revisión", y necesita defender una elección de modelo ante el equipo.

## 9. Mercado / jurisdicción

Chile (Qubico, BancoEstado y clientes finales chilenos). Proveedores de modelos extranjeros (transferencia internacional de datos: fuera del alcance de la pestaña, pero registrada).

## 10. Propuesta de alcance del proceso (decide el usuario)

Es una pestaña nueva de una herramienta interna con alcance funcional ya acordado. Propongo proceso completo pero comprimido:

| Fase | Propuesta |
|---|---|
| 1 Investigación | Ligera: sin entrevistas; proto-persona, 1–2 CUJ, inventario de lo que hoy responde cada sección y benchmark breve de patrones de evaluación de clasificadores. |
| 2 Ideación + 3 AI | Juntas: qué se reemplaza/mueve, orden de secciones dentro de la pestaña, glosario de métricas. |
| 4 Flows + 5 Patrones | Juntas: flujo "ranking → criterio → llamada → pestaña Revisión"; patrones de chart y accesibilidad (no depender solo del color en heatmap y mapa). |
| 6 UX writing | Titulares con conclusión, glosario "Cómo leer las métricas", aviso de "lo que no se mide". |
| 7 Prototipado | Wireframe HTML con datos ficticios (no reales) de la pestaña y sus estados. Sin test formal con usuarios. |
| 8 Alta fidelidad | Se omite: se reutilizan tokens y componentes del template. Handoff directo a `dashboard_template.html`. |

## 11. Registro legal inicial

Ver `registro-legal.md` (L-01 a L-06).
