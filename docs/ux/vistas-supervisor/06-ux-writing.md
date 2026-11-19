# Fase 6 · UX Writing · Calidad del servicio

Fecha: 2026-11-17 · Estado: **pendiente de aprobación** (va junto con la Fase 5).
Hereda la voz, el tono y el trato de "tú" de `docs/ux/call-audit/06-ux-writing.md` (H-44). Aquí solo va lo propio de la sección. `{x}` es un valor que se interpola y nunca se escribe fijo.

---

## 1. Voz y tono en esta sección

| Principio | En la práctica |
|---|---|
| **Describe, no juzga** | "Marca distinto que la IA", nunca "inconsistente" ni "sesgado". "Sobre el equipo", nunca "peor" |
| **Siempre dice la fuente** | Toda cifra lleva "según la IA" o "según la planilla" |
| **Hallazgo, no sanción** (regla 5) | "Para revisar", no "para corregir al ejecutivo". "Ejemplos", no "pruebas" |
| **Títulos que concluyen** cuando hay dato | "En 4 motivos la planilla marca menos que la IA" en lugar de "Resumen de motivos" |
| **Breve y en cifras** | Porcentajes sin decimales en las listas y con un decimal en el detalle; "pts" para diferencias |

| Contexto | Tono | Ejemplo |
|---|---|---|
| Aviso informativo | Neutro, explica la causa | "Parte de la diferencia viene de los datos de la gestión, no del ejecutivo." |
| Vacío | Dice por qué y qué pasará | "Todavía no hay datos. Aparecerán cuando se procese la próxima corrida." |
| Error | Qué pasó + qué hacer, sin culpar | "No pudimos cargar los motivos. Reintentar" |
| Muestra chica | Prudente | "pocas llamadas" |

## 2. Encabezado y banda de la foto

| Elemento | Texto |
|---|---|
| Título de la sección (`PageHeader`) | **Calidad del servicio** |
| Descripción | "Cómo se cumple la pauta según la IA y según la planilla de calidad." |
| Banda (una corrida, D-18 A) | "Datos al {dd-mmm} · corrida {versión} · planilla hasta {dd-mmm}" |
| Banda (corridas distintas, D-18 B) | "Datos al {dd-mmm} · por llamada: corrida {v1} · por motivo: corrida {v2} · planilla hasta {dd-mmm}" + nota: "Las cifras por llamada y por motivo vienen de versiones distintas de la IA." |
| Pestañas | Motivos · Ejecutivos · Evaluadores · Informes |
| Filtros | "Tipo de seguro" (opción "Todos") · "Flujo" (opción "Todos") · botón "Quitar filtros" |
| Mensaje al filtrar (`role="status"`) | "Mostrando {n} motivos · {tipo} · {flujo}" |

## 3. Motivos

| Elemento | Texto |
|---|---|
| Título con dato (ejemplo) | "En {n} motivos la IA y la planilla difieren en más de {u} puntos" |
| Columnas | Motivo · Según la IA · Según la planilla · Diferencia · Criterio |
| Unidad bajo el encabezado | "% de llamadas" (IA y planilla) · "pts" (Diferencia) |
| Estados del criterio | "Parejo" · "Se marca distinto" · "Explicado por los datos" |
| Ayuda bajo la tabla | "**Según la IA:** % de llamadas con este motivo en No cumple, sobre todas las llamadas con corrida ({n}). **Según la planilla:** lo mismo, sobre las llamadas evaluadas en la planilla ({m}). **Diferencia:** planilla menos IA, en las llamadas que tienen las dos. **Se marca distinto:** la mayoría de los evaluadores no coincide con la IA en este motivo, así que conviene revisar cómo está definido." |
| Aviso del motivo 25 (D-10) | "Parte de la diferencia viene de los datos de la gestión: el sistema registra una fila por grabación aunque en la llamada se gestionen varios seguros. No refleja solo el trabajo del ejecutivo." |
| Detalle de motivo: subtítulos | "Dónde se concentra" · "Ejecutivos que se desvían en este motivo" · "Ver todos los ejecutivos" |

## 4. Ejecutivos

| Elemento | Texto |
|---|---|
| Selector | "Motivo" (opción "Todos los motivos") |
| Columnas (con motivo) | Ejecutivo · Llamadas · Según la IA · Según la planilla · Frente al equipo |
| Columnas (sin motivo) | Ejecutivo · Llamadas · Con algún No cumple, según la IA · Según la planilla · Frente al equipo |
| Desvío | "+{x} pts sobre el equipo" · "−{x} pts bajo el equipo" · "Igual que el equipo" (±2 pts) |
| Pocas llamadas | "pocas llamadas" |
| Ayuda bajo la tabla | "**Llamadas:** con corrida / evaluadas en la planilla. **Frente al equipo:** diferencia con el promedio de todos los ejecutivos en este motivo, según la IA. No es un ranking: sirve para elegir qué llamadas escuchar." |
| Ficha: subtítulos | "Motivos donde más se aleja del equipo" · "Ver los 33 motivos" · "Sus llamadas" |

## 5. Evaluadores (solo Qubico)

| Elemento | Texto |
|---|---|
| Nota fija arriba | "Solo la ven personas de Qubico." |
| Columnas | Evaluador · Llamadas evaluadas · Marca distinto que la IA · Más estricto o permisivo · Frente al equipo |
| Valores de severidad | "Más estricto (+{x} pts)" · "Más permisivo (−{x} pts)" · "Parejo" |
| Ayuda bajo la tabla | "**Marca distinto que la IA:** % de sus llamadas donde él y la IA no coinciden en el motivo. **Más estricto o permisivo:** si cuando no coinciden suele marcar No cumple (estricto) o Cumple (permisivo). Un evaluador estricto pero parejo no es un problema; uno que marca distinto en casos parecidos sí." |
| Detalle técnico (plegado) | "Detalle técnico: acuerdo con la IA por motivo (kappa de Cohen). 1 = acuerdo total, 0 = el que se espera por azar." |

## 6. Lista de llamadas y detalle

| Elemento | Texto |
|---|---|
| Título | "{n} llamadas · Motivo {N} · No cumple según {la IA / la planilla}" + filtros activos |
| Paginación | "Llamadas {a}–{b} de {n}" · "Anterior" · "Siguiente" |
| Banner en `/calls/[id]` | "Vienes de Calidad del servicio · Motivo {N} · {fuente}. Volver" |
| Sin evidencia de la IA | "La planilla marcó este motivo; la IA no encontró evidencia en la transcripción." |

## 7. Informes

| Elemento | Texto |
|---|---|
| Columnas de la lista | Informe · Fecha · Corrida · (Qubico: Audiencia: "Empresa" / "Interno") |
| Corrida distinta | "Este informe usa la corrida {x}; las cifras de la sección son de la {y}." |
| Enlace dentro del informe | "Ver en Motivos" / "Ver en Ejecutivos" |
| No encontrado / no autorizado | "No encontramos este informe." |

## 8. Estados (S-01 a S-07)

| ID | Texto |
|---|---|
| S-01 | "Todavía no hay datos de calidad del servicio. Aparecerán cuando se procese la próxima corrida o planilla." |
| S-02 | "Esta foto no trae planilla de calidad. Se muestra solo lo que marcó la IA." |
| S-03 | "No hay llamadas con {tipo} y {flujo} en esta foto." + "Quitar filtros" |
| S-04 | "pocas llamadas" (y en la ayuda: "Con menos de 10 llamadas la cifra puede cambiar mucho.") |
| S-05 | Aviso del motivo (§3) |
| S-06 | "No pudimos cargar {los motivos / los ejecutivos / el informe}. Reintentar" |
| S-07 | Banda con corridas distintas (§2) |
| Informes vacíos | "Todavía no hay informes publicados." |

## 9. Glosario (se suma a `docs/ux/call-audit/06-ux-writing.md` §5 al aprobar)

| Término | Uso | Código |
|---|---|---|
| **Calidad del servicio** | La sección | `/analysis`, `analysis` |
| **Foto** (solo interno; en la UI "Datos al {fecha}") | Cálculo precomputado | `analysis_snapshot` |
| **Según la IA / según la planilla** | Fuente de la cifra | `source = ai / sheet` |
| **Diferencia** | % planilla − % IA, en pts | `gap_pts` |
| **Frente al equipo** | Desvío contra la media | `deviation_pts` |
| **Marca distinto que la IA** | Desacuerdo del evaluador | `disagreement_rate` |
| **Más estricto / más permisivo** | Severidad | `severity_pts` |
| **Se marca distinto / Parejo / Explicado por los datos** | Estado del criterio | `criterion_status = divergent / consistent / data_explained` |
| **Pocas llamadas** | Base < 10 | `low_sample` |
| **Informe** · Audiencia **Empresa / Interno** | Documento publicado | `report.audience = company / internal` |
| **Evaluador** | Persona de la empresa que llenó la planilla | `evaluator` |

Se mantiene **Motivo** en la UI y `criterion` en el código.

---

## 10. Ajuste 2026-11-18 · La referencia es el auditor (D-31)

Pedido de Johannes: "aquí en vez de segun planilla, deberia ser, según auditor. En el caso de que no haya habido resultado de un auditor, entonces usa lo de la metadata, pero si hay feedback de auditor, se usa eso."

**Regla:** por llamada, la referencia humana es la revisión del auditor en la app (`reviews`). Si no hay revisión, se usa la marca por motivo de la planilla. En la UI esa referencia se llama siempre **"el auditor"**. Cuando importa saber de dónde salió (la banda, la lista de llamadas, el aviso de la llamada), se aclara con **"en la app"** o **"de la planilla"**. "Planilla" deja de ser el nombre de la fuente y queda como el origen de una parte de los datos.

### 10.1 Textos

| Lugar | Texto actual | Texto nuevo |
|---|---|---|
| Descripción del encabezado | Cómo se cumple la pauta según la IA y según la planilla de calidad. | Cómo se cumple la pauta según la IA y según el auditor. |
| Chip de fuente y encabezado de columna (Motivos, detalle, Ejecutivos, ficha, lista de llamadas) | Según la planilla | **Según el auditor** (ícono `UserCheck` en lugar de `Building2`) |
| Banda: mezcla de app y planilla | · planilla hasta {fecha} | · auditor: {n} revisadas en la app · {m} de la planilla hasta {fecha} |
| Banda: solo app | — | · auditor: {n} revisadas en la app |
| Banda: solo planilla | · planilla hasta {fecha} | · auditor: {m} de la planilla hasta {fecha} |
| Banda: sin ninguna (S-02) | Esta foto no trae planilla de calidad. Se muestra solo lo que marcó la IA. | Esta foto no trae revisiones del auditor ni planilla de calidad. Se muestra solo lo que marcó la IA. |
| Título de Motivos | En {n} motivos la IA y la planilla no coinciden en 10 % de las llamadas o más | En {n} motivos la IA y el auditor no coinciden en 10 % de las llamadas o más |
| Ayuda Motivos · No coinciden | % de las llamadas evaluadas en la planilla donde una fuente marca el motivo y la otra no. | % de las llamadas revisadas por un auditor donde una fuente marca el motivo y la otra no. |
| Ayuda Motivos · Según el auditor | Según la planilla: lo mismo, sobre las llamadas evaluadas en la planilla ({m}). | Según el auditor: lo mismo, sobre las llamadas revisadas por un auditor ({m}): su revisión en la app o, si no la hay, la planilla. |
| Ayuda Motivos · Diferencia | planilla menos IA, en puntos. Dice hacia dónde se inclina, pero puede esconder llamadas que no coinciden. | auditor menos IA, en puntos. Dice hacia dónde se inclina, pero puede esconder llamadas que no coinciden. |
| Ayuda Motivos · Se marca distinto | la mayoría de los evaluadores no coincide con la IA en este motivo… | la mayoría de los auditores no coincide con la IA en este motivo… |
| KPI del detalle | Diferencia (planilla − IA) | Diferencia (auditor − IA) |
| Bases (hints, ficha, ayudas) | {m} evaluadas en la planilla · sobre {m} llamadas evaluadas | {m} revisadas por un auditor · sobre {m} llamadas revisadas por un auditor |
| Ayuda Ejecutivos · Llamadas | con corrida / evaluadas en la planilla. | con corrida / revisadas por un auditor. |
| `aria-label` de cifras | … según la planilla. Ver llamadas | … según el auditor. Ver llamadas |
| Estado del criterio sin referencia | Sin planilla | Sin auditor |
| Fuente en `/analysis/calls` | No cumple según la planilla · La IA y la planilla no coinciden | No cumple según el auditor · La IA y el auditor no coinciden |
| Lista de llamadas: columna | Según la planilla | Según el auditor, con una segunda línea en texto secundario por fila: "en la app" o "de la planilla" |
| Aviso en `/calls/[id]` | La planilla marcó este motivo; la IA no encontró evidencia en la transcripción. | El auditor marcó este motivo; la IA no encontró evidencia en la transcripción. + texto secundario: "(revisión en la app)" o "(de la planilla)" |
| Pestaña Evaluadores (solo Qubico) | Evaluadores | **Auditores** |
| Columna y filtro | Evaluador · `Evaluador {nombre}` | Auditor · `Auditor {nombre}` |
| Caption | Evaluadores, ordenados por cuánto marcan distinto que la IA | Auditores, ordenados por cuánto marcan distinto que la IA |
| Volver | ← Evaluadores | ← Auditores |
| Base de la tabla | Llamadas evaluadas | Llamadas revisadas |
| Vacío de la pestaña | Esta foto no trae el evaluador de la planilla. / La pestaña se llena cuando la planilla importada incluye la columna del evaluador de calidad. | Esta foto no trae auditores. / La pestaña se llena con las revisiones hechas en la app o cuando la planilla importada incluye la columna del evaluador de calidad. |
| Nota de la pestaña (nueva) | — | Cada fila es la persona que revisó: un auditor en la app o quien llenó la planilla. Se indica con "en la app" o "de la planilla". |

Sin cambios: "Según la IA", "No coinciden", "Marca distinto que la IA", "Más estricto o permisivo", "Frente al equipo", "pocas llamadas" y S-01 ("…cuando se procese la próxima corrida o planilla").

### 10.2 Por qué "Auditores" para la pestaña

- **A, recomendada: "Auditores".** Encaja con "Según el auditor": la pestaña mide justamente a quien hizo la referencia. En la app el rol auditor es quien revisa, y ahora sus revisiones son la referencia principal, así que el nombre calza. La ruta `/auditors` (productividad) redirige en modo real y no está en la sidebar del supervisor (D-04), así que no compiten en el menú. Qubico es el único que ve esta pestaña. La ruta interna `/analysis/evaluators` puede quedar como está.
- **B: "Evaluadores".** Deja de calzar con la columna "Según el auditor".
- **C: "Revisores".** Choca con D-28, que lo retiró.

### 10.3 Glosario (reemplaza filas de §9)

| Término | Uso | Código (sin cambio) |
|---|---|---|
| **Según la IA / según el auditor** | Fuente de cada cifra. El auditor es la revisión en la app o, si no la hay, la planilla | `source = ai / sheet` |
| **Auditor** (en Calidad del servicio) | Quien hizo la referencia de una llamada: auditor de la app o quien llenó la planilla | `evaluator` |
| **en la app / de la planilla** | Aclaración del origen de la referencia | `reference_origin = review / sheet` (sugerido) |

"Evaluador" sigue vigente (D-28) en las pantallas que solo comparan con la planilla: métricas del prompt y Análisis de discrepancias.

## 11. Ajuste 2026-11-19 · Criterios y motivos de renuncia (Iteración 2, D-42 a D-47)

En toda esta sección, "motivo" (punto de la pauta) pasa a **"criterio"**: pestaña "Criterios", "Criterio {n} · {nombre}", "Ver los 33 criterios", "Criterio: todos", "Se marca distinto: … en este criterio", y lo mismo en títulos, tooltips, `aria-label`, `<caption>` y estados vacíos de `09b` §C. "Motivo" queda solo para el **motivo de renuncia**. Reglas completas y textos del modal del criterio 18: `10-criterios-y-motivos-de-renuncia.md` §3.3 y §5.4. Glosario: `docs/ux/call-audit/06-ux-writing.md` §2.8 y §5.
