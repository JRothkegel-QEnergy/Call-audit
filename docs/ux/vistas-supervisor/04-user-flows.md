# Fase 4 · User flows · Calidad del servicio

Fecha: 2026-11-17 · Estado: **pendiente de aprobación**.
Base: D-01 a D-15 (`estado.md`), sitemap en `03-arquitectura-informacion.md` §3. Nombre de la sección: **Calidad del servicio**, ruta `/analysis` (D-14). La ola 1 es solo lectura (D-15). Sin puntos legales (D-00).

Convenciones: `[ ]` pantalla · `{ }` decisión · `(( ))` estado del sistema · las líneas punteadas son estados vacíos o de error.

---

## 0. Estados comunes a toda la sección

| ID | Estado | Cuándo | Qué ve el usuario | Salida |
|---|---|---|---|---|
| S-01 | **Sin foto** | El script todavía no corrió nunca | "Todavía no hay datos de calidad del servicio. Aparecerán cuando se procese la próxima corrida o planilla." | Ninguna acción; enlace a Inicio |
| S-02 | **Sin planilla** | Hay corrida pero ninguna llamada trae planilla | Columnas "Según la planilla" con "—" y nota "Esta foto no trae planilla de calidad"; la IA se muestra igual | Sigue navegable |
| S-03 | **Filtro sin datos** | El cruce de tipo de seguro × flujo no tiene llamadas | "No hay llamadas con {tipo} y {flujo} en esta foto." + "Quitar filtros" | Quitar filtros |
| S-04 | **Pocas llamadas** | Base menor a 10 (D-07) | La fila sigue visible, atenuada, con "pocas llamadas"; no entra en el orden por desvío | — |
| S-05 | **Explicado por los datos** | Motivo marcado (D-10) | Aviso en la fila y en el detalle; va al final del orden por defecto | Leer el aviso |
| S-06 | **Error de carga** | Falla la API | Patrón `AsyncView` existente: "No pudimos cargar {qué}. Reintentar" | Reintentar |
| S-07 | **Foto con corridas mezcladas** | Los datos por llamada y por motivo vienen de corridas distintas | Encabezado: "Por llamada: corrida v3.0 · Por motivo: corrida v2.10 · Datos al {fecha}" | Depende de la pregunta 3 |

Encabezado fijo de todas las pestañas: **"Datos al {fecha} · corrida {versión} · planilla hasta {fecha}"**. Usa `SourceBadge` (existe en `/dashboard`) para "Según la IA" y "Según la planilla".

## 1. CUJ-1 · Detectar un motivo que se incumple o que está mal definido (Verónica)

```mermaid
flowchart TD
  A([Entra a la app]) --> B{"¿Hay foto?"}
  B -- No --> S1[/"S-01 Sin foto"/]
  B -- Sí --> C["[Motivos] /analysis/criteria<br/>33 filas por bloque · IA · planilla · diferencia · estado"]
  C --> D{"¿Aplica filtros<br/>tipo de seguro / flujo?"}
  D -- Sí --> D1{"¿Hay llamadas?"}
  D1 -- No --> S3[/"S-03 Filtro sin datos"/] --> C
  D1 -- Sí --> C
  D -- No --> E["Elige un motivo (clic en la fila)"]
  E --> F["[Motivo N] /analysis/criteria/[id]<br/>dónde se concentra (tipo × flujo) · ejecutivos que se desvían · estado del criterio"]
  F --> G{"¿Explicado por los datos?"}
  G -- Sí --> G1["Lee el aviso (S-05)<br/>y sigue o vuelve"]
  G -- No --> H["Clic en una cifra<br/>(IA, planilla o una celda tipo × flujo)"]
  G1 --> H
  H --> I["[Llamadas] lista paginada de esa cifra"]
  I --> J["Abre una llamada"]
  J --> K["[Detalle] /calls/[id]?from=analysis&t=mm:ss<br/>banner de origen · reproductor en el minuto"]
  K --> L{"¿Hay evidencia de la IA en ese motivo?"}
  L -- Sí --> K1["Parte en el minuto de la cita"]
  L -- No --> K2["Parte en 0:00 con aviso:<br/>'La planilla marcó este motivo; la IA no encontró evidencia'"]
  K1 --> M(["Volver a la cifra con filtros intactos"])
  K2 --> M
```

## 2. CUJ-2 · Comparar ejecutivos en un motivo y llevar evidencia al feedback (Verónica)

```mermaid
flowchart TD
  A["[Ejecutivos] /analysis/agents"] --> B{"¿Filtró por motivo?"}
  B -- No --> B1["Vista general: % de llamadas con algún No cumple,<br/>IA y planilla, desvío, base"]
  B -- Sí --> B2["% No cumple en el motivo, IA y planilla,<br/>desvío en pts, base · orden por desvío (D-07)"]
  B1 --> C
  B2 --> C["Elige un ejecutivo"]
  C --> C0{"¿Pocas llamadas?"}
  C0 -- Sí --> C1[/"S-04 Fila atenuada; se puede abrir igual"/] --> D
  C0 -- No --> D["[Ficha] /analysis/agents/[id]?criterion=N<br/>perfil por motivo vs. equipo · sus llamadas"]
  D --> E["Filtra sus llamadas por el motivo (ya aplicado si venía filtrado)"]
  E --> F["Abre la llamada → /calls/[id] en el minuto"]
  F --> G(["Sale con 1–3 llamadas de ejemplo<br/>(el feedback se registra fuera de esta sección, D-15)"])
```

También se entra desde **Motivo N** → "Ejecutivos que se desvían" → ficha (atajo hacia CUJ-2).

## 3. CUJ-3 · Publicar la foto y los informes, y presentar (Qubico)

```mermaid
flowchart TD
  A(("Corrida cerrada o planilla importada")) --> B(("Script de la foto (D-08)"))
  B --> C{"¿Terminó bien?"}
  C -- No --> C1(("Se mantiene la foto anterior;<br/>error en el log y en Procesamiento"))
  C -- Sí --> D(("Foto nueva con fecha y corrida"))
  E["Analista escribe el informe con Claude<br/>(Markdown + encabezado, D-09)"] --> F{"¿Cómo se carga?<br/>(pregunta 1)"}
  F --> G(("Informe publicado con audiencia"))
  D --> H["Admin revisa [Evaluadores] /analysis/evaluators<br/>y [Motivos]"]
  G --> H
  H --> I["Detalle técnico del evaluador (kappa)<br/>/analysis/evaluators/[id]"]
  H --> J(["Presenta a la empresa con la cuenta supervisor de prueba (D-12)"])
```

Si una nueva foto queda vigente mientras alguien mira la sección, la página no cambia sola. Al navegar aparece un aviso: "Hay datos nuevos (al {fecha}). Actualizar" (pregunta 4).

## 4. Tarea secundaria · Leer un informe (Verónica o Qubico)

```mermaid
flowchart TD
  A["[Informes] /analysis/reports<br/>título · fecha · corrida · audiencia"] --> B{"¿Hay informes para su rol?"}
  B -- No --> B1[/"'Todavía no hay informes publicados.'"/]
  B -- Sí --> C["[Informe] /analysis/reports/[slug]"]
  C --> D{"¿La corrida del informe = la de la foto?"}
  D -- No --> D1["Aviso: 'Este informe usa la corrida {x}; las cifras de la sección son de la {y}.'"]
  D -- Sí --> E["Lee; los enlaces 'Ver en Motivos' abren la vista con el filtro"]
  D1 --> E
```

Verónica solo ve los informes con audiencia "empresa". Un enlace directo a uno "interno" responde "No encontramos este informe" (no "no tienes permiso"), para no revelar que existe.

## 5. Auditoría de los flujos

| Tipo | Hallazgo | Dónde | Cambio |
|---|---|---|---|
| Paso de más | En el borrador, Motivos → Motivo N → "Ver llamadas" → lista. El botón intermedio no aporta | CUJ-1 | La cifra misma es el enlace a la lista (−1 clic) |
| Paso de más | Para filtrar Ejecutivos por motivo, había que ir a Ejecutivos y elegir el motivo de nuevo | Motivo N → Ejecutivos | "Ejecutivos que se desvían" dentro de Motivo N, y enlace a `/analysis/agents?criterion=N` (−2 pasos) |
| Cuello de botella | En el detalle de la llamada había que buscar el minuto a mano | `/calls/[id]` | Parámetro `t` + banner de origen (patrón D-58) |
| Cuello de botella | La diferencia IA vs. planilla del 25 genera dudas sin explicación | Motivos | Aviso S-05 y orden al final (D-10) |
| Redundancia | Los filtros se pedían otra vez al volver de la llamada | Todas | Filtros en la URL; volver los conserva (D-65 de call-audit) |
| Redundancia | Rutas antiguas `/agents`, `/dashboard/criteria`, `/auditors` y las nuevas mostraban lo mismo | Sidebar | En modo real, redirección a `/analysis/…` (D-04) |
| Callejón sin salida | Celda "IA No cumple" sin evidencia en la transcripción | `/calls/[id]` | El aviso del flujo §1 y el reproductor en 0:00 |
| Callejón sin salida | Filtro sin llamadas | Todas | S-03 con "Quitar filtros" |
| Callejón sin salida | Enlace antiguo a `/discrepancies` para un supervisor (D-11) | Marcadores | Redirige a `/analysis` (a Inicio si no tiene acceso) |
| Error sin recuperación | El script falla y la sección queda vacía | CUJ-3 | Se mantiene la foto anterior (C1) y nunca se muestra una foto a medias |

**Conteo de clics (desde que entra a la app):**

| Tarea | Antes (el borrador) | Después |
|---|---|---|
| CUJ-1: ver la llamada de ejemplo de un motivo | Sidebar → Motivos → motivo → "Ver llamadas" → llamada → buscar el minuto = 5 + búsqueda | Sidebar → motivo → cifra → llamada = **4**, ya en el minuto |
| CUJ-2: llamada de ejemplo de un ejecutivo en un motivo | Sidebar → Ejecutivos → elegir el motivo → ejecutivo → filtrar llamadas → llamada = 6 | Desde Motivo N: ejecutivo → llamada = **2** desde la cifra (K-04); desde la sidebar = 5 |
| Leer un informe | — | Sidebar → Informes → informe = **3** |

Hoy (producto actual, modo real) ninguna de estas tareas es posible: las vistas muestran "no disponible".

## 6. Puntos legales

No aplica (D-00).
