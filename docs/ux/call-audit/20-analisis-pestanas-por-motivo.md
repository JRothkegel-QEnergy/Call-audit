# Cambio 20 · Análisis de discrepancias en pestañas y revisión por motivo

> Revisión rápida sobre lo aprobado (fases 0–8, Cambios 16, 18 y 19). Fecha: 2026-11-09. **Estado: aprobado e implementable (2026-11-09; Q1–Q5 = A, D-92 a D-97; §13 cierra la especificación).**
> **Aprobación (textual, vía coordinador):** "Apruebo todas".
> **Pedido de Johannes (textual):** "La vista está muy sobrecargada de cosas, tiene muchos gráficos, luego tiene las métricas por evaluador, por prioridad, los patrones, quedando una vista que puedes escrolear mucho. Todo lo que está en la vista es útil, quizás buscar una forma de ponerlo en pestañas o algo así que haga que sea más ameno. Por otro lado, las listas muy largas cansan, por lo que quizás deberíamos ver una forma de paginar ciertas cosas. Por ejemplo los patrones, quizás sería útil que uno pudiera ir revisando por motivo, de alguna forma agruparlos por motivo e ir aceptando o descartando de esa forma. Esto también para las observaciones. […] Los nombres de las columnas no me quedan muy claros para Por evaluador de la planilla. ¿El % de rechazadas qué es? ¿No cumple por llamada qué implica? ¿Solo IA, omitidos?"
> **Numeración:** P-20.x, R-20.x; decisiones D-92 a D-97; supuestos H-149 a H-156 (en `hipotesis.md`).
> **Registro Legal:** se omite por instrucción vigente de Johannes. Nada de este cambio lo bloquea.
> **Revisado:** `16-ia-discrepancias.md`, `19-discrepancias-visual.md`, `18-version-desde-seguimiento.md`, `05-patrones.md`, `frontend/src/app/(app)/admin/discrepancies/page.tsx` y `patterns/[id]/pattern-detail.tsx`, `frontend/src/components/admin/discrepancy-charts.tsx`, `discrepancy-parts.tsx`, `ai-quality.tsx`, `dialogs/shortcuts-dialog.tsx`, `calls/[id]/call-detail.tsx`, `src/call_audit/discrepancy_runs.py`, `discrepancies.py`.
> **No revisado en el navegador.** El diagnóstico sale del código y de los resultados agregados del análisis `prod-2026-11-04` (v1.0.0); las alturas son estimadas.

---

## 0. Decisiones

| # | Decisión | Origen |
|---|---|---|
| D-92 | Cinco pestañas en una fila: Resumen (por defecto), Patrones, Evaluadores, Seguimiento e Historial. Reemplaza H-115 | Johannes (Q1 A) |
| D-93 | Patrones se revisa con panel lateral de motivos, avance por motivo y "Siguiente motivo". "Todos los motivos" conserva la lista por impacto, de a 10 | Johannes (Q2 A) |
| D-94 | Aceptar una observación la deja en Seguimiento, en "Para calibrar con el auditor", con texto editable. Descartar exige motivo. Nunca puede volverse regla del prompt. Ajusta R-16.3 | Johannes (Q3 A) |
| D-95 | En bloque solo se descartan observaciones de un motivo, con un único motivo de descarte. Los patrones se deciden uno a uno | Johannes (Q4 A) |
| D-96 | Tabla por evaluador con los nombres de §7, total y tasa ("23 · 1,5 por llamada") y fila fija "Todos los evaluadores" | Johannes (Q5 A) |
| D-97 | La fila "Sin evaluador en la planilla" se muestra atenuada, al final y fuera de "Todos los evaluadores". Tras la reimportación son 100 de 1.100 llamadas: las de octubre, cuya planilla no trae la columna | Johannes (dato); diseñador (especificación) |

## 1. Proporcionalidad

Reordena la arquitectura de **una pantalla** ya aprobada. No agrega sección a la sidebar, no crea un CUJ y no cambia el flujo lanzar → revisar → aceptar/descartar → Seguimiento. Por eso va como **Cambio 20 con documento propio y un solo gate**, sin volver a la Fase 3 global. Reemplaza §7.2 del Cambio 16 y §7.2 del Cambio 19 en lo que dice del orden de bloques.

| Lo aprobado | Qué pasa con este cambio |
|---|---|
| D-80 (arriba: cifras + dónde se arregla + barras por motivo) | Se mantiene: es la pestaña Resumen |
| D-82 (mapa de prioridad plegado, usable como filtro) | Se mantiene, plegado, en Patrones › Todos los motivos |
| D-83 (Gráfico / Tabla) | Se mantiene |
| D-64, D-67 (aceptar no toca el prompt, texto editable, descartar con motivo) | Se mantienen; mismos diálogos |
| D-69 (detalle del patrón en página propia) | Se mantiene; mejora el "volver" |
| H-108 (orden por impacto) | Se mantiene en Todos los motivos y dentro de cada motivo |
| H-115 (tres pestañas bastan) | **Se reemplaza**: cinco pestañas (Q1) |
| H-138 (cada gráfico lleva a la lista filtrada) | Se mantiene, ahora cambiando de pestaña |
| R-16.3 (observaciones sin aceptar) | **Ajustado** por D-94: se aceptan para calibrar o se descartan |
| `05-patrones.md` (paginación numerada 25/50/100) | Excepción acotada: listas cortas, paginador simple como D-59 |

## 2. Diagnóstico

**Escala real** (`prod-2026-11-04`, v1.0.0, agregados de los archivos locales; la base puede diferir un poco):

| Dato | Valor |
|---|---|
| Motivos analizados | 28 |
| Patrones con 3 o más casos | 58, en 24 motivos |
| **Máximo de patrones en un motivo** | **4** |
| Observaciones | 83 (76 de la IA + 7 patrones con menos de 3 casos) |
| **Máximo de observaciones en un motivo** | **6** |

Hay más observaciones que patrones, y al agrupar por motivo ninguna lista interna pasa de 10 elementos. **Agrupar por motivo resuelve casi todo el largo sin paginar**; la paginación queda para las vistas transversales.

**Hallazgos en el código:**

| # | Hallazgo | Consecuencia |
|---|---|---|
| 1 | El overview ya trae patrones, observaciones, motivos y evaluadores completos | Pestañas, agrupación y paginación son del front, sin backend |
| 2 | Las observaciones **no se pueden decidir**: `decide()` las rechaza, `pattern_out` les devuelve `proposal: null`, y las que vienen de la IA solo traen texto y casos, sin propuesta | "Aceptar una observación" hoy no significa nada (Q3) |
| 3 | Con el filtro Pendientes, un patrón decidido desaparece al instante | La lista salta justo cuando se está revisando. Hay que fijarlo |
| 4 | Las fichas del mapa usan `#pattern-id` | Con páginas o motivos, el patrón puede no estar en pantalla; hay que navegar al motivo |
| 5 | "Patrones" en el detalle vuelve a `/admin/discrepancies` a secas | Se pierden motivo y filtros al volver |
| 6 | El paginador está duplicado dos veces en `ai-quality.tsx` | Se extrae un `Pager` común |
| 7 | "Rechaza" contradice el vocabulario aprobado (2026-10-19: Cumple / No cumple) | Se renombra |
| 8 | Los atajos existen con J/K, desactivables, sin efecto en campos ni diálogos | Se pueden extender con el mismo patrón |

## 3. Problema y requisitos

- **P-20.1** Un solo scroll mezcla tres trabajos: entender el panorama, decidir propuestas y comparar evaluadores.
- **P-20.2** Las listas largas cansan: ~58 tarjetas seguidas (del orden de 15.000 px, estimado) y 28–33 filas de motivos.
- **P-20.3** No se puede revisar por motivo ni ver cuánto falta por motivo.
- **P-20.4** Las observaciones se leen, pero no se pueden cerrar.
- **P-20.5** Las columnas por evaluador no se entienden y mezclan unidades (llamadas y casos).

| Requisito | Cubre |
|---|---|
| **R-20.1** Separar la vista por trabajo, sin perder contenido | P-20.1 |
| **R-20.2** Los gráficos siguen llevando a la lista filtrada, cambiando de pestaña y dejando visible el filtro | P-20.1, H-138 |
| **R-20.3** Revisar patrones y observaciones agrupados por motivo, con avance por motivo y paso al siguiente | P-20.2, P-20.3 |
| **R-20.4** Decidir sin perder el lugar: la tarjeta no salta y se puede deshacer | P-20.3 |
| **R-20.5** Cerrar observaciones | P-20.4 |
| **R-20.6** Paginar o acortar las listas transversales, con estado en la URL | P-20.2 |
| **R-20.7** Tabla por evaluador con nombres, unidades y ayuda visibles | P-20.5 |

## 4. Nueva estructura

Una sola fila de pestañas, sin pestañas dentro de pestañas. **Por defecto: Resumen.**

| Pestaña | URL | Pregunta | Contenido |
|---|---|---|---|
| **Resumen** | sin `tab` | ¿Cómo vamos y dónde duele? | Encabezado y Analizar · 4 cifras · ¿Dónde se arregla? · ¿Quién tiene más razón? · Cobertura · ¿Dónde están los desacuerdos? (10 motivos) · Cómo leer este análisis |
| **Patrones (n)** | `tab=patterns` | ¿Qué decido? | Panel de motivos + patrones y observaciones del motivo · Todos los motivos (filtros, mapa de prioridad, lista paginada) |
| **Evaluadores** | `tab=evaluators` | ¿Hay un evaluador que marque distinto? | Tabla paginada |
| **Seguimiento (n)** | `tab=followup` | ¿Qué falta aplicar? | Sin cambios |
| **Historial** | `tab=history` | ¿Qué análisis se han corrido? | Sin cambios |

- "Patrones" incluye las observaciones: en el glosario una observación es un patrón con menos de 3 casos. El contador `(n)` son las propuestas por decidir, igual que la cifra del Resumen.
- Un análisis anterior (`analysis=`) se mantiene al moverse entre Resumen, Patrones y Evaluadores, con su banner en las tres. Solo se limpia al ir a Seguimiento o Historial.
- En Patrones, el aviso "Desactualizado" y la línea "Analizando…" se repiten como una línea corta. El botón Analizar vive solo en Resumen.

### 4.1 Wireframe · Resumen (datos sintéticos)

```
Análisis de discrepancias
[ Resumen ] [ Patrones (52) ] [ Evaluadores ] [ Seguimiento (3) ] [ Historial ]
─────────────────────────────────────────────────────────────────────────────────────
Corrida vigente Gemini 3.8 Flash · v2.10 · Último análisis 04-11 21:10 · Sonnet 5.5 · 3,25 USD
                                                                  [ Analizar de nuevo ]
 1.120 casos en desacuerdo │ 71 % explicado │ 52 propuestas por decidir │ 3 de 9 resueltas

¿Dónde se arregla?       [████ Regla 18 %][▓▓▓ Calibrar 22 %][▒▒▒ Empresa 26 %][ Sin patrón 29 %]
¿Quién tiene más razón?  Sin dato en este análisis…
480 llamadas · 1.120 casos en desacuerdo · 40 con revisión manual Qubico (5 %)

¿Dónde están los desacuerdos?                                      [ Gráfico | Tabla ]
                                   Solo la IA detectó ◄──┼──► Omitidos por la IA
 25 · No tipifica todas las gestiones      97 ■■■■■■■■■■■│                    0
 18 · Tipifica motivo de renuncia inc.     36       ■■■■▨│■■■■■■■■▨          69
  …  (10 motivos)
 [ Ver los 33 motivos ]
 Clic en un motivo: abre sus patrones.

▸ Cómo leer este análisis
```

### 4.2 Wireframe · Patrones, por motivo

```
[ Resumen ] [ Patrones (52) ] [ Evaluadores ] [ Seguimiento (3) ] [ Historial ]
─────────────────────────────────────────────────────────────────────────────────────
Causa [Todas ▾]   Tipo [Todos ▾]
┌ Motivos ─────────────────────┐  Motivo 18 · Tipifica motivo de renuncia incorrecto
│ 9 de 28 motivos listos       │  36 solo la IA detectó · 69 omitidos por la IA · 25 casos sin patrón
│ [■■■■■□□□□□□□□]              │  Ver en Calidad de la IA →            [← Anterior] [Siguiente motivo →]
│                              │
│ Todos los motivos            │  Patrones por decidir (2)
│ ──────────────────────────── │  ┌ 2 · Cuando el cliente da dos razones, la IA acepta cualquiera
│ 25 · No tipifica todas…      │  │ Omitidos por la IA · Criterio del prompt · Confianza media · 21 casos
│      Listo                   │  │ Evidencia: llamada 231063 · «…»
│▌18 · Tipifica motivo de re…  │  │ Propuesta · Regla del prompt: "Si el cliente da más de un motivo…"
│      2 patrones · 3 obs.     │  │ [ Aceptar  A ]  [ Descartar  D ]  [ Ver casos (21) ]
│  1 · Deja en espera por…     │  └─────────────────────────────────────────────────────
│      1 patrón · 4 obs.       │  ┌ 5 · …
│  6 · No maneja informaci…    │  └─────────────────────────────────────────────────────
│      4 patrones · 2 obs.     │
│  …                           │  Observaciones por decidir (3)        [ Descartar las 3 ]
│ 5 motivos sin patrones       │  · Llamada con dos gestiones que el ejecutivo tipifica en una · 1 caso
│ ni observaciones             │    [ Aceptar ]  [ Descartar ]  [ Ver casos (1) ]
└──────────────────────────────┘  · …
                                  ▸ Decididas (1)

                                  [← Anterior]                 [Siguiente motivo: 1 · 5 por decidir →]
```

### 4.3 Wireframe · Patrones, Todos los motivos

```
┌ Motivos ──────────────┐  [ Patrones (58) | Observaciones (83) ]
│▌Todos los motivos     │  Causa [Todas ▾]  Tipo [Todos ▾]  Estado [Pendientes ▾]
│ 25 · 1 patrón         │  Filtros: Regla del prompt ✕   Empezar aquí ✕   [Quitar filtros]
│ …                     │  ▸ Prioridad de los patrones (52 pendientes)
└───────────────────────┘
                           Patrones · ordenados por impacto
                           (10 tarjetas)
                           Patrones 11–20 de 58                [Anterior] 2 de 6 [Siguiente]
```

## 5. Revisar por motivo

**Panel de motivos**
- Fila por motivo con patrones u observaciones (28 hoy). Orden fijo: el del gráfico, de más a menos desacuerdos. **No se reordena al decidir**, para que las filas no salten.
- Cada fila dice lo que falta ("2 patrones · 3 obs.") o **Listo**. Arriba, "9 de 28 motivos listos" con su barra.
- Listo significa que no queda nada por decidir en ese motivo, patrones ni observaciones.
- Sin paginar: el panel queda fijo al hacer scroll y tiene su propio scroll. Bajo 1280 px pasa a un `select`.
- Sin `motivo` en la URL se abre el primero con pendientes.

**Contenido del motivo**
- Encabezado con sus cifras; luego Patrones por decidir (por impacto), Observaciones por decidir, y Decididas plegadas.
- Las tarjetas de patrón son las actuales. Las observaciones van como filas compactas.
- "Siguiente motivo" salta al próximo con pendientes y dice cuántos tiene.

**Decidir sin perder contexto**
1. Mismos diálogos de hoy; suman una línea "Motivo 18 · {título}".
2. Al confirmar, la tarjeta **se queda en su lugar** con su estado y "Volver a pendiente". Pasa a Decididas recién al cambiar de motivo o de página.
3. El foco va a la siguiente pendiente del motivo.
4. Al cerrar el último: "Motivo 18 listo." con "Siguiente motivo". **No avanza solo.**
5. Sin pendientes en ningún motivo: "Revisaste todos los motivos." con enlace a Seguimiento.

**Filtros**

| Filtro | Comportamiento nuevo |
|---|---|
| Causa, Tipo | Pasan de botones a `select` (una línea). Reducen el panel a los motivos con coincidencias y ajustan sus conteos |
| Estado | Solo en Todos los motivos. Dentro de un motivo no hace falta: pendientes y decididas se ven separadas |
| Filtros que vienen de los gráficos | Quedan visibles como chips con ✕ en Patrones |
| Observaciones con filtros de causa, tipo, cuadrante, acción o más razón | No tienen esos datos: se ocultan y lo dice una línea, con "Quitar filtros" |

**Desde los gráficos (todos cambian de pestaña y mueven el foco al título)**

| Clic en | Destino |
|---|---|
| Fila de motivo, gráfico o tabla | `tab=patterns&motivo=18` |
| Segmento de ¿Dónde se arregla? | `tab=patterns&motivo=all&action=…` |
| Segmento Observación | `tab=patterns&motivo=all&kind=obs` |
| Segmento Sin patrón | Se queda en Resumen, con la línea y enlace de hoy |
| Segmento de ¿Quién tiene más razón? | `tab=patterns&motivo=all&right=…` |
| Cuadrante del mapa | Ya está en Todos: agrega `quad=…` |
| Ficha del mapa | `motivo={id}` y lleva a esa tarjeta |
| "Ver por qué" (Calidad de la IA) | `tab=patterns&motivo=18` |

Los enlaces antiguos se resuelven según §13.2.

**Volver desde el detalle:** el enlace pasa a "← Motivo 18" y recupera la URL exacta de la lista (guardada en `sessionStorage`, como ya se hace con el caso). Si no existe, usa `tab=patterns&motivo=18`.

**Atajos** (solo en Patrones, mismas reglas que la revisión de llamadas: desactivables en Preferencias, sin efecto en campos ni con diálogos abiertos):

| Tecla | Acción |
|---|---|
| J / K | Elemento siguiente / anterior (mismo significado que en la llamada) |
| A | Aceptar el elemento en foco (abre el diálogo) |
| D | Descartar el elemento en foco (abre el diálogo) |
| M / Shift+M | Motivo siguiente / anterior con pendientes |

No se usan flechas (mueven el scroll) ni `[` `]` (en teclado latinoamericano requieren AltGr). Se agrega una sección a la ayuda de atajos (`?`). En solo lectura, A y D no hacen nada.

## 6. Paginación

Componente común `Pager` ("Patrones 11–20 de 58", Anterior, "2 de 6", Siguiente), extraído de `ai-quality.tsx`. Todo en el cliente.

| Lista | Tratamiento | Tamaño | URL |
|---|---|---|---|
| Patrones de un motivo | Sin paginar (máximo 4 hoy) | Pager solo si superan 10 | — |
| Observaciones de un motivo | Sin paginar (máximo 6 hoy) | Pager solo si superan 10 | — |
| Patrones, Todos los motivos | Páginas | **10 tarjetas** | `page` |
| Observaciones, Todos los motivos | Páginas | **20 filas** | `page` + `kind=obs` |
| Panel de motivos | Sin paginar, scroll propio | 28 filas | `motivo` |
| Motivos en Resumen (gráfico y tabla) | Primeros 10 + "Ver los n motivos" | 10 | `motives=all` |
| Evaluadores | Páginas | **15 filas** + fila Todos fija | `evalPage` |

- Los motivos no se paginan porque van ordenados: lo importante queda arriba y partirlos rompería la comparación de barras.
- Cambiar un filtro, el orden o la vista Patrones/Observaciones vuelve a la página 1. Una página fuera de rango se ajusta a la última.
- Decidir no reacomoda la página (hallazgo 3): lo decidido se mantiene visible hasta cambiar de página o filtro.
- Al cambiar de página, el foco va al título de la lista y el rango se anuncia con `aria-live`.

## 7. Tabla por evaluador

Encabezado en dos niveles, para que la unidad se vea sin leer ayuda:

```
Por evaluador de la planilla
Un evaluador que marca mucho más o menos que el resto, con la IA pareja, apunta a una diferencia del evaluador, no del prompt.

                     │ Llamadas                                  │ Motivos         │ Casos
 Evaluador           │ Evaluadas │ Veredicto    │ Calce de       │ No cumple       │ Solo la IA        │ Omitidos
                     │    ▼      │ No cumple    │ llamada        │ marcados        │ detectó           │ por la IA
                     │ llamadas  │ % de llamadas│ % de llamadas  │ prom. x llamada │ casos             │ casos
 Todos los evaluadores   1.000       48 %           58 %             1,8             940 · 0,9 por llam.  445 · 0,4 por llam.
 Ana Rojas                 120       52 %           61 %             2,1             101 · 0,8 por llam.   30 · 0,3 por llam.
 Luis Soto                  15       80 %           40 %             3,4              23 · 1,5 por llam.    4 · 0,3 por llam.
 …
 Sin evaluador en la planilla 100    —              —                —                80 · 0,8 por llam.   41 · 0,4 por llam.
```

| Hoy | Nombre nuevo | Unidad | Ayuda visible bajo la tabla |
|---|---|---|---|
| Evaluador | Evaluador | "Nombre Apellido" | Quien evaluó la llamada en la planilla de calidad |
| Llamadas | Llamadas evaluadas | llamadas | Sus llamadas con corrida vigente y marca por motivo en la planilla |
| Rechaza (planilla) | **Veredicto No cumple** | % de sus llamadas | De sus llamadas, en qué porcentaje dejó el veredicto de llamada No cumple (en la planilla figura como RECHAZADA) |
| Calce con la IA | **Calce de llamada** | % de sus llamadas | De sus llamadas, en qué porcentaje la IA dio el mismo veredicto de llamada que la planilla |
| NO CUMPLE por llamada | **Motivos No cumple marcados** | promedio por llamada | Cuántos motivos marca No cumple, en promedio, en cada llamada que evalúa |
| Solo la IA | **Solo la IA detectó** | casos | La IA marcó No cumple en ese motivo y el evaluador no |
| Omitidos | **Omitidos por la IA** | casos | El evaluador marcó No cumple en ese motivo y la IA no |

Bajo la tabla, siempre visible: "Un caso es un motivo de una llamada. Una llamada puede aportar varios casos, por eso estas columnas pueden superar a Llamadas evaluadas."

- **Orden por defecto:** Llamadas evaluadas, de mayor a menor (primero las muestras grandes). Todas las columnas se ordenan con clic (`aria-sort`, `evalSort`, `evalDir`).
- **Fila Todos los evaluadores:** fija arriba en todas las páginas; es la referencia para comparar. Porcentajes y promedios ponderados por llamadas, sin la fila sin dato.
- **Pocas llamadas:** con menos de 10 llamadas, el nombre lleva "pocas llamadas" en texto secundario.
- **Sin dato (D-97):** hoy son 100 llamadas, las de octubre. Fila "Sin evaluador en la planilla", atenuada, siempre al final de la última página, sin importar el orden, y fuera de la fila Todos. Llamadas y casos con su tasa; los otros tres valores con "—". Nunca lleva "pocas llamadas". Nota visible en todas las páginas: "{n} llamadas no traen evaluador en la planilla y no entran en Todos los evaluadores." `{n}` sale de la fila, no se escribe fijo, y no nombra el mes. Si no hay ningún evaluador, sigue el mensaje actual de reimportar.
- La ayuda va en texto visible porque la app no tiene tooltip accesible, y fue justamente lo que faltó.

## 8. Estados

| Estado | Qué se ve |
|---|---|
| Sin llamadas o sin desacuerdos | Los mensajes actuales, en lugar de las tres primeras pestañas |
| Sin análisis con IA | Resumen como hoy. Patrones: "Todavía no hay análisis con IA." con enlace a Resumen. Evaluadores funciona igual |
| Análisis en curso o parcial | El panel lista solo los motivos terminados y se refresca cada 5 s, sin mover el motivo abierto |
| Motivo analizado sin patrones ni observaciones | "La IA no encontró un patrón: los desacuerdos parecen casos aislados." |
| Motivo sin analizar (desde URL) | "Este motivo no se analizó." con enlace a Resumen |
| Filtros sin resultados | "Ningún patrón con estos filtros." + Quitar filtros |
| Solo lectura | Banner en las tres pestañas; panel con avance real, sin botones de decisión |

## 9. Textos nuevos

Pestañas: Resumen · Patrones · Evaluadores · Seguimiento · Historial. Botones: Ver los {n} motivos · Mostrar solo 10 · Siguiente motivo · Anterior · Todos los motivos. Secciones: Patrones por decidir · Observaciones por decidir · Decididas. Avance: "{k} de {n} motivos listos" · "Motivo {id} listo." · "Revisaste todos los motivos."

Glosario (sumado a `06-ux-writing.md`): **Caso** = un motivo de una llamada. **Listo** = motivo sin nada por decidir. **Veredicto No cumple** reemplaza a "Rechaza". Se mantienen Planilla de calidad, la empresa, Solo la IA detectó y Omitidos por la IA; "cliente" solo es la persona que llama.

## 10. Accesibilidad (WCAG 2.2 AA)

- Panel: `nav` con `aria-label="Motivos"`, filas como botones con `aria-current` y nombre completo ("Motivo 18: 2 patrones y 3 observaciones por decidir"). Listo va en texto, no solo color.
- Al cambiar de motivo, de pestaña por un gráfico o de página, el foco va al título (`tabIndex=-1`). El avance se anuncia con `aria-live`.
- El panel fijo no tapa el foco (2.4.11): `scroll-margin` en las tarjetas.
- Atajos de una tecla desactivables (2.1.4). Todo se puede hacer sin ellos.
- Tabla: encabezados con `scope="colgroup"` y `scope="col"`; ordenar es un botón dentro del `th`. Objetivos ≥ 24 × 24 px.

## 11. Implementación

Sin librerías ni tokens nuevos. Se reusan `.tabs`, `.seg`, `.chip`, `.card`, `.tbl`, `Button` con `shortcut`, `Dialog`, `PatternCard`, los gráficos actuales y `usePreferences`.

- **Componentes nuevos:** `Pager`, `CriterionRail`, `CriterionReview`, `ObservationRow`, `EvaluatorTable`. `page.tsx` (915 líneas) se parte por pestaña.
- **Ajustes:** `CriteriaChart` recibe límite de filas; las fichas de `PriorityMap` navegan al motivo; `pattern-detail.tsx` cambia el volver; `ai-quality.tsx` cambia "Ver por qué" y usa `Pager`; `ShortcutsDialog` suma la sección.
- **Backend:** ninguno para estructura, paginación y tabla. Las observaciones requieren el ajuste de §13.1, sin migración (`ProposalDecision` ya va por `pattern_id`) y sin corridas de IA.
- **Por verificar al implementar:** que el panel quede fijo dentro del layout actual y que las tarjetas tengan buen ancho a 1280 px con la sidebar abierta.
- **Detectado, fuera de alcance:** "¿Quién tiene más razón?" dice "El auditor" para referirse al evaluador de la planilla, y las listas de Seguimiento y los casos del detalle no se paginan. Se pueden tomar después.

## 12. Preguntas para Johannes (respondidas: todas A, ver §0)

**Q1 · ¿Cómo separamos la vista?**
- **A (recomendada):** cinco pestañas en una sola fila: Resumen (por defecto), Patrones, Evaluadores, Seguimiento e Historial. Cada una es un trabajo distinto y no hay pestañas dentro de pestañas.
- B: dejar Análisis, Seguimiento e Historial, y poner dentro de Análisis una segunda fila con Resumen, Patrones y Evaluadores. Mantiene las tres pestañas, pero suma un nivel.
- C: como A, pero abriendo en Patrones cuando hay propuestas por decidir. Lleva directo al trabajo, pero se pierde el panorama al entrar.

**Q2 · ¿Cómo recorremos los patrones por motivo?**
- **A (recomendada):** panel lateral con todos los motivos y lo que falta en cada uno; al elegir uno se ven solo sus patrones y observaciones, con botón "Siguiente motivo". Incluye "Todos los motivos" para seguir viendo la lista completa por impacto, paginada de a 10.
- B: una sola lista con un acordeón por motivo. Es más simple, pero vuelve a ser un scroll largo cuando se abren varios.
- C: modo asistente, un motivo por pantalla con Anterior y Siguiente, sin panel. Enfoca más, pero no deja ver el conjunto ni saltar a un motivo.

**Q3 · ¿Qué significa aceptar una observación?** Hoy no se pueden aceptar ni descartar. Son casos sueltos (1 o 2 casos) y casi siempre solo traen un texto, sin propuesta concreta. Hoy hay 83.
- **A (recomendada):** Aceptar la deja en Seguimiento, en "Para calibrar con el auditor", con su texto editable. Descartar pide motivo, igual que los patrones, y el próximo análisis lo recibe. No puede transformarse en regla del prompt, porque 1 o 2 casos no alcanzan como evidencia (el mínimo aprobado es 3). Requiere un ajuste chico de backend.
- B: como A, pero al aceptar eliges si va a calibrar o a regla del prompt, escribiendo tú la regla. Más flexible, pero abre la puerta a cambiar el prompt con muy poca evidencia.
- C: solo un botón "Revisada", sin pasar a Seguimiento. Es lo más simple, pero lo que valga la pena no queda registrado en ninguna parte.

**Q4 · ¿Se puede decidir en bloque por motivo?**
- **A (recomendada):** solo para descartar observaciones: "Descartar las 3" del motivo, con un único motivo de descarte. Los patrones se deciden uno a uno, porque cada propuesta es distinta y puede terminar en el prompt.
- B: además, "Aceptar todos" y "Descartar todos" los patrones del motivo. Es más rápido, pero se aceptan propuestas sin leerlas ni editarlas.
- C: nada en bloque; todo uno a uno. Con 83 observaciones son muchos clics.

**Q5 · En la tabla por evaluador, ¿cómo mostramos los casos?** Hoy "23" en un evaluador de 15 llamadas no se puede comparar con "23" en uno de 120. Los nombres propuestos: Llamadas evaluadas, Veredicto No cumple, Calce de llamada, Motivos No cumple marcados, Solo la IA detectó y Omitidos por la IA.
- **A (recomendada):** con esos nombres, mostrar el total y al lado la tasa ("23 · 1,5 por llamada"), más una fila fija "Todos los evaluadores" para comparar.
- B: mismos nombres, solo totales y fila fija. Más limpio, pero hay que sacar la cuenta de cabeza para comparar.
- C: mismos nombres, solo la tasa por llamada. Permite comparar, pero se pierde cuántos casos son.

## 13. Especificación de cierre para implementar

### 13.1 Ajuste de backend (D-94, D-95)

Sin migración, sin IA y sin subir versión del prompt de análisis. Una observación puede venir sin propuesta (caso suelto de la IA), con propuesta y menos de 3 casos (incluso de tipo regla), o con 3 o más casos y sin texto de propuesta. **Las tres se tratan igual.**

| Punto | Cambio |
|---|---|
| Texto base | Helper `observation_text(data)`: `proposal.text` → `explanation` → `title`, el primero no vacío |
| `pattern_out` | Campo nuevo `observationText: string \| null`, con valor solo si `isObservation` |
| `pattern_out.proposal` en observaciones | `null` si no hay decisión o está en `pending`, para no presentarla como propuesta de la IA. Con cualquier otro estado: `{ type: "calibrate_auditor", action: null, find: null, text: observationText, editedText }`. **El tipo es siempre `calibrate_auditor`**, aunque `data.proposal.type` diga otra cosa |
| `decide()` | Se quita `raise ValueError("observation")`. El original para `edited_text` es `observation_text` en observaciones. Motivo obligatorio y `pending` quedan igual |
| `set_follow_up()` | En observaciones, `asked_client` responde 409 `observation_status`. `calibrated` y `accepted` funcionan |
| `accepted_rules()` (`prompt_followup.py`) | **Agregar `and not p.is_observation`.** Sin esto, una observación aceptada cuyo `data.proposal.type` sea `prompt_rule` podría entrar a una versión. Con el filtro responde `not_accepted`, como cualquier id inválido |
| `discarded_for()` | En observaciones usa `observation_text`; mismo formato `{text, reason}`. `render_discarded` no cambia, y el diálogo de costo cuenta estos descartes automáticamente |
| `analysis_summary` | Sin cambios: `pendingProposals` sigue siendo solo patrones |
| `follow_up()`, `follow_up_counts()` | Sin cambios. Las observaciones decididas entran por diseño a Seguimiento y a sus contadores |

**Descarte en bloque**

```
POST /api/admin/discrepancies/observations/discard
{ "ids": ["…"], "reason": "La evidencia no alcanza" }
→ 200 DiscrepancyPattern[]  (mismo orden de ids, con su estado actual)
```

| Caso | Respuesta |
|---|---|
| `reason` vacío | 422 `reason_required` |
| `ids` vacío | 422 `no_ids` |
| Ids de más de un motivo | 422 `mixed_criteria` |
| Algún id no existe | 404 `not_found` |
| Algún id no es observación | 409 `not_observation` |
| Algún id ya no está pendiente | No se toca y vuelve con su estado actual (otro admin pudo decidirlo) |

Todo en una transacción. Una línea en el Registro de actividad: acción `observations_discarded`, destino `Motivo {id} · observaciones`, detalle `{n} observaciones · {reason}`. Si el Registro traduce las acciones, sumar la etiqueta.

**Front y mock:** `ApiClient.discardObservations({ ids, reason })`; `observationText: string | null` en `DiscrepancyPattern`; en `discrepancy-mock.ts`, quitar el error `observation` y agregar el descarte en bloque. **Test existente que cambia:** `tests/test_discrepancy_runs.py:122` espera 409 al aceptar una observación.

**Diálogos de observación**
- `AcceptDialog`: título "¿Aceptar esta observación?"; ayuda fija `ACCEPT_HELP.calibrate` (no pasar por `followUpGroup`: con `proposal` en `null` caería en "client"); etiqueta "Texto para calibrar"; valor inicial `observationText`; Nota opcional.
- `DiscardDialog`: título "¿Descartar esta observación?"; misma lista de motivos.
- Bloque: "Descartar las {k}", visible con 2 o más observaciones pendientes y fuera de solo lectura. Título "¿Descartar las {k} observaciones de este motivo?". Ayuda: "El próximo análisis las recibe para no repetirlas. Puedes volver a pendiente cada una." Botón "Descartar {k}". Las filas se quedan en su lugar con su estado.

### 13.2 URLs

Se resuelve en una sola función, al leer los parámetros:

| Entrada | Resultado |
|---|---|
| `tab` = `patterns`, `evaluators`, `followup` o `history` | Esa pestaña |
| Sin `tab`, `tab=analysis` o un valor desconocido, **sin** `motivo`, `cause`, `type`, `quad`, `action`, `right` ni `kind` | Resumen |
| Sin `tab`, `tab=analysis` o desconocido, **con** alguno de esos | Patrones |
| Ese caso legado, sin `motivo` | Se trata como `motivo=all`: era una lista global |
| `tab=patterns` sin `motivo`, con `quad`, `action`, `right` o `kind` | `motivo=all` |
| `tab=patterns` sin `motivo`, solo con `cause` o `type`, o sin filtros | Primer motivo con pendientes y coincidencias; no se escribe en la URL |
| `motivo` numérico que no existe en el análisis | Estado "Este motivo no se analizó." |
| `motivo` no numérico y distinto de `all` | Como si no viniera |
| `motivo` numérico + `status=all` (enlace antiguo de Calidad de la IA) | `status` se ignora dentro del motivo |
| `page` o `evalPage` inválido o fuera de rango | Se ajusta al rango, sin reescribir la URL |
| `analysis=` | Se conserva en Resumen, Patrones y Evaluadores; las pestañas Seguimiento e Historial lo borran |

La URL antigua no se reescribe al cargar: cambia recién con el primer gesto del admin.

**Parámetros al interactuar**

| Gesto | Cambios |
|---|---|
| Causa, Tipo, Estado, Patrones/Observaciones, Quitar filtros, elegir motivo | `page: null` |
| Segmento de ¿Dónde se arregla? o ¿Quién tiene más razón? | Además `status=all` (como hoy: las barras cuentan también lo decidido) |
| Cuadrante | `status: null` (como hoy: el mapa cuenta solo pendientes) |
| Ordenar evaluadores | `evalPage: null` |
| Cambiar de pestaña | No borra filtros; solo `analysis`, según la tabla anterior |

- El motivo se marca en el gráfico solo con `motivo` numérico. Un clic siempre va al motivo; ya no alterna.
- La ficha del mapa navega con `motivo={id}` y luego hace `scrollIntoView` y foco sobre `pattern-{id}`, con el mismo `setTimeout` de `focusPatterns`. No usa `#` en la URL.
- Con `motives=all`, el plegable "motivos sin desacuerdos" sigue como hoy; sin ese parámetro no se muestra.

### 13.3 Estado en el front

- **Subir `overview` y `decided` a `DiscrepancyAnalysis`.** Hoy `AnalysisTab` se desmonta al cambiar de pestaña: se recargaría todo y se perderían las decisiones locales. Además, el contador de Patrones vive en la fila de pestañas.
- El contador de Patrones cuenta sobre `patterns`, con `decided` aplicado, los que no son observación y siguen en `pending`. Así baja al decidir.
- **Una decisión en Seguimiento** (por ejemplo, Volver a pendiente) recarga `overview` en silencio y limpia `decided`. Al cambiar `analysis`, también se limpia.
- **Tarjetas que no saltan:** un conjunto `justDecided` mantiene visibles esos ids; se vacía al cambiar `motivo`, `page` o un filtro. En Decididas no aparecen los que siguen en ese conjunto. Los títulos cuentan solo lo pendiente real.
- **Orden del panel:** el de `data.criteria`. Un motivo con patrones que ya no esté en `criteria` (análisis desactualizado) va al final como "Motivo {id}".
- **Motivo explícito sin coincidencias con los filtros:** no se cambia de motivo. Se muestra "Ningún patrón con estos filtros en el motivo {id}." con Quitar filtros y Siguiente motivo.
- **Atajos:** el orden de J/K es patrones por decidir (más `justDecided`) y luego observaciones; A y D no hacen nada sobre un elemento ya decidido. El estado del diálogo tiene que subir desde `PatternActions` para poder abrirlo con teclado. `onKey` normaliza a minúscula: M y Shift+M se distinguen con `e.shiftKey`.
- **Evaluadores:** la fila sin dato se detecta con la constante `NO_EVALUATOR = "sin dato"` (la clave que manda el backend). La paginación corre solo sobre evaluadores con nombre y la fila sin dato se agrega al final de la última página. "Todos los evaluadores" suma las filas con nombre: `clientCallFails / calls`, `callMatch / calls`, `clientFails / calls`, `fp`, `fn`.
- **Volver desde el detalle:** guardar la URL de la lista en `sessionStorage` (clave `discrepancies-list-url`) con un efecto en la pestaña Patrones, y leerla en un `useEffect` de `pattern-detail.tsx`. Las observaciones también tienen detalle. El enlace pasa a "← Motivo {id}".
- **Gráfico limitado:** la escala se sigue calculando con todas las filas, para que no cambie al expandir.
