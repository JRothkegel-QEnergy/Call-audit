# Mosaico de acuerdo IA vs. la corredora · Brief (Fase 0, proceso reducido)

- **Fecha:** 2026-11-11 · **Pide:** jefe de Johannes (Lead Developer) · **Usuario:** admin de Qubico, que lo usa para mostrar avance al jefe.
- **Dónde:** detalle de cada versión del prompt (`admin/prompts/[version]/prompt-version.tsx`, pestaña "Prueba"), solo en la app.
- **Tipo:** componente nuevo sobre una pantalla aprobada (`00-cambio-metricas-prompt.md`). No es un cambio menor: agrega una
  visualización y una fuente de datos nueva (análisis de discrepancias). Se propone proceso reducido: brief → propuesta
  (patrón + copy + wireframe en texto) → implementación.

## Problema y objetivo

- **P-02:** la tabla de métricas no deja ver de un vistazo cuánto del desacuerdo es culpa del prompt y cuánto de la planilla.
- **P-03:** no hay forma de ver la evolución entre vueltas del loop de mejora (v2.12 → v2.13 → …).
- **Objetivo:** que el jefe vea en 5 s (a) cuánto acuerdo hay, (b) cuánto desacuerdo es del prompt/criterio (rojo + amarillo)
  y (c) si eso baja vuelta a vuelta. Meta: rojo y amarillo → casi cero.

## Requisitos

| ID | Requisito |
|---|---|
| R-05 | Partes mutuamente excluyentes que suman 100 %: acuerdo, IA Sí/Rev No (rojo), IA No/Rev Sí (amarillo), atribuido a la corredora (azul), sin decisión de la IA. |
| R-06 | Dos unidades: por llamada (titular) y por llamada × motivo (detalle), con su n y su fórmula visibles. |
| R-07 | Lo azul se rotula como juicio de la IA: "según el análisis", no como hecho. |
| R-08 | Segmentos de 1–2 % legibles (no tapados por el verde). |
| R-09 | Comparación entre versiones del prompt sobre el mismo set de validación. |
| R-10 | No depender solo del color (WCAG 1.4.1): valores y etiquetas en texto, tabla equivalente para lector de pantalla. |

## Hallazgos del código que condicionan el diseño

1. **La causa "auditor" es por patrón, no por caso.** `discrepancy_analysis.py` devuelve patrones con `cause` y una lista
   `cases`. Un caso puede estar en dos patrones con causas distintas o en ninguno. Hace falta una regla para asignar cada
   desacuerdo a un solo color.
2. **Hay más causas que "auditor" y "prompt":** `rule_text`, `ai_application`, `motive_overlap`, `transcript`,
   `missing_data`. Transcripción y dato faltante no son del prompt.
3. **El análisis corre sobre tablas de discrepancias de prod** (`prod-2026-11-04`, `prod-2026-11-10`), con Sonnet (pagado), por
   motivo. No corre hoy sobre la prueba de cada versión. Para que el azul exista en v2.13, v2.14… hay que correrlo en cada
   vuelta (costo) o reutilizar la atribución por caso.
4. **A nivel llamada no existe causa.** Una llamada en desacuerdo puede tener motivos con causas mezcladas.
5. **Denominadores distintos a la tabla actual:** la tabla muestra FP sobre aprobadas (33 %) y FN sobre rechazadas (39 %);
   el mosaico muestra sobre el total de llamadas (amarillo 16 %, rojo 20 %). Dos números distintos para "lo mismo" en la
   misma pestaña.

## Propuesta preliminar de patrón (a validar en la siguiente ronda)

- **Titular (por llamada):** barra apilada horizontal al 100 % (mosaico de una fila, fiel al dibujo del jefe:
  rojo/amarillo | azul | gris sin decisión | verde), con % y conteo en cada segmento o en la leyenda.
- **Detalle (llamada × motivo):** el verde se resume en un número ("97 % de acuerdo") y la barra muestra **solo el
  desacuerdo como 100 %** ("de los 990 desacuerdos: 46 % rojo, 43 % amarillo, 11 % azul"). Así 1,4 % no desaparece.
- **Evolución:** una barra por versión, alineadas y en el mismo orden de colores (v2.12, v2.13, …), con la vigente marcada.
  Opcional: línea chica de rojo y amarillo por versión.
- Tabla equivalente oculta (o desplegable "Ver como tabla") para accesibilidad.

## Fuera de alcance

- Presentación / export (decisión de Johannes).
- Re-correr el análisis de discrepancias sin OK y costo aprobado.

## Supuestos

- **[SUPUESTO] H-03:** el jefe lee mejor un mosaico de una fila que una tabla de tasas.
- **[SUPUESTO] H-04:** el set de validación es el mismo entre vueltas (si cambia, la evolución no es comparable).
- **[SUPUESTO] H-05:** la atribución "auditor" de la IA de análisis es razonablemente confiable; no está calibrada con el
  call center.
