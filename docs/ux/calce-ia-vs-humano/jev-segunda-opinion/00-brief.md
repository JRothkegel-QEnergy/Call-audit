# Fase 0 (reducida) · Brief · "Segunda opinión Jev" en el dashboard de revisión

Fecha: 2026-10-20 · Estado: **pendiente de aprobación** · Herramienta interna de I+D (no es el producto Call Audit).
Contexto padre: `../00-brief.md` (pestaña "Calce IA vs humano", también en Fase 0 sin aprobar).

## 1. Problema

El experimento Jev (TypeSafe AI) produjo, para 28 pares llamada-motivo en 21 de 100 llamadas, una probabilidad p(incumple) en 8 variantes (modelo × idioma × modo). Hoy esos resultados viven en un reporte aparte (`jev/<source>/report.html`) que muestra el número pero no permite escuchar la llamada ni contrastar la evidencia de Gemini. Johannes necesita juzgar **par por par** si Jev acierta, y la revisión manual actual es **por llamada**, lo que mezcla motivos: P-01.

| ID | Dolencia |
|---|---|
| P-01 | La etiqueta manual es por llamada; no dice qué motivo concreto estaba bien o mal aplicado (caso real: llamada que Johannes rechazó, pero anotó que el motivo 16 estaba mal aplicado y Jev lo revirtió; el reporte lo cuenta como error de Jev). |
| P-02 | Para juzgar a Jev hay que saltar entre `report.html` y el dashboard (audio, transcripción, evidencia de Gemini). |
| P-03 | Las 8 variantes no valen lo mismo: el modo "con hallazgo" está anclado a Gemini y casi siempre confirma. Mostrarlas en pie de igualdad induce a error. |
| P-04 | Las probabilidades se agrupan entre 0,4 y 0,8: un "revierte/confirma" binario con umbral 0,5 sobrevende la seguridad de Jev. |
| P-05 | No hay forma de encontrar rápido las 21 llamadas con Jev ni las que Jev revierte. |

## 2. Objetivo y KPIs [SUPUESTO]

- K-J1: Johannes etiqueta los 28 pares sin salir del dashboard (0 visitas a `report.html`).
- K-J2: Tras etiquetar, se puede calcular el acierto de cada variante de Jev **y de Gemini** por par, sin recodificar a mano.
- K-J3: Ninguna lectura de "con hallazgo" como evidencia independiente (aviso visible).

## 3. Alcance

**Sí:** bloque "Segunda opinión Jev" bajo cada motivo revisado (pestaña Gemini 3.8 Flash); aviso a nivel de llamada; filtro y marcador en el listado; etiqueta manual por motivo, persistida en el mismo flujo de guardado que "Mi revisión".
**No:** volver a correr Jev, cambiar umbral o lógica de `jev_review.py`, sumar Jev al ranking de la pestaña "Calce IA vs humano" (se decide aparte, ver pregunta 5), tokens o componentes nuevos (se reutilizan `.chip`, `.crit`, `.mybox`, `--good/--warn/--crit`).

## 4. Restricciones

- HTML autocontenido generado por `dashboard.py`; JS vanilla; datos en `const D`.
- `dashboard_template.html` y `dashboard.py` tienen cambios sin commitear de otra sesión: implementar sobre ellos, sin pisarlos.
- Persistencia: `review_server.py` (PUT de columnas + filas a `revision_capa2.csv`) o `localStorage` (`l2-review-v1`).
- Jev corrió sobre una versión concreta del prompt de Gemini: el bloque solo es válido con esa versión seleccionada.
- Escritorio; no romper a 900 px.

## 5. Usuarios

Johannes (decide, auditor interno, usuario principal) y ocasionalmente otra persona del equipo vía `revisar.bat`. Conocen la pauta de motivos. No se requiere investigación (Fase 1 no aplica).

## 6. Jurisdicción

Chile. Ver `registro-legal.md` de esta carpeta (L-J1, L-J2) y el del padre (L-01 a L-06).
