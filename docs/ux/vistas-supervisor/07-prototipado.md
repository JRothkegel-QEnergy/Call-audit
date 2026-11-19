# Fase 7 · Prototipado · Calidad del servicio

Fecha: 2026-11-17 · Estado: **pendiente de aprobación**.
Base: D-01 a D-25 (`estado.md`), flujos (`04-user-flows.md`), patrones (`05-patrones.md`), textos (`06-ux-writing.md`). Sin temas legales (D-00). No se tocó el frontend real.

**Prototipo:** `07-prototipo.html` (un solo archivo, se abre con doble clic en Chrome o Edge). Los datos salen de `07-prototipo-datos.py`:

```
python 07-prototipo-datos.py call_audit.db rubrics/bancoestado_retention/v1.0.1.yaml data.json
```

El JSON resultante se inyecta en el HTML en lugar de `__DATA__`.

## 0. Datos del prototipo (D-24)

| Qué | Fuente | Real o sintético |
|---|---|---|
| Marcas por motivo de la IA y su minuto de evidencia | `model_runs` vigente de la base local: **corrida v2.10** (gemini-3-8-flash), 100 llamadas del 01 al 05-oct | Real (agregado) |
| Marcas por motivo y veredicto de la planilla | `cases.external_item_fails` / `external_verdict` | Real (agregado) |
| Tipo de seguro | Agrupado desde el nombre del producto: Accidentes personales 71, Sale Seguro 16, Vida y salud 11, Incendio Hogar 2. `TIPO_SEGURO` viene vacío en la base local | Real, agrupación del diseñador |
| Flujo | `customer.flow`: las 100 son "Intención de renuncia" | Real |
| Nombres de los 44 ejecutivos e IDs de llamada (`L-0001`…) | Mapeo determinístico | **Sintético** |
| Evaluadores (5, con pesos 36/28/20/11/5 %) | La base local no trae evaluador (Cambio 20, D-97) | **Sintético** (aviso visible en la pestaña) |
| Informes | Contenido de la reunión del 16-nov (corrida v3.0) y una nota interna | Ejemplo |
| Corrida v3.0 | No existe en la base local (H-17). La banda la rotula al simular S-07 | Simulado |

El rótulo de la corrida está en la banda de todas las pantallas ("corrida v2.10") y en la barra superior del prototipo.

## 7a. Wireframes (en el mismo HTML, escala de grises)

| Pantalla | Ruta (prototipo `#` = app `/analysis`) | Cubre | Estados que se pueden ver |
|---|---|---|---|
| Motivos | `#/criteria` | R-04, O-02, O-03, D-02, D-06, D-10 | Normal · S-02 (simular) · S-03 (tipo "Desgravamen") · S-07 (simular) · S-01 (simular) |
| Detalle de motivo | `#/criteria/18` | CUJ-1, O-08 | "Se marca distinto" (18), "Explicado por los datos" (25), pocas llamadas por tipo |
| Ejecutivos | `#/agents?criterion=6` | R-01, D-07, D-22 | Aviso "todos con pocas llamadas", aviso del motivo 25 |
| Ficha del ejecutivo | `#/agents/{nombre}` | CUJ-2, D-23 | 10 motivos / "Ver los 33" |
| Evaluadores (solo Qubico) | `#/evaluators` y `#/evaluators/{nombre}` | R-02, D-01, D-06, D-13 | Con el rol Supervisor: "No encontramos esta página." · Kappa plegado |
| Informes | `#/reports`, `#/reports/{slug}` | R-05, D-09, D-16 | Corrida distinta · informe interno oculto para Supervisor ("No encontramos este informe.") |
| Lista de llamadas | `#/calls?criterion=8&source=sheet` | D-17, O-05 | Columna "Evidencia de la IA" con minuto o "sin evidencia de la IA" |
| Detalle de llamada (maqueta) | `#/call/L-0009?criterion=8` | Flujo §1 | Banner de origen · inicio en el minuto · "La planilla marcó este motivo; la IA no encontró evidencia" |

Cada pantalla trae una anotación punteada con los requisitos y decisiones que cubre. La sidebar del supervisor muestra tachados los ítems que salen en modo real (D-04, D-11).

## 7b. Prototipo navegable

Un solo HTML con rutas internas, controles de rol (Supervisor / Qubico) y simulación de estados (S-01, S-02, S-07). Los tres CUJ se recorren así:

- **CUJ-1:** Motivos → "Motivo 18" → cifra "Según la planilla" → lista → llamada → Volver (los filtros se conservan).
- **CUJ-2:** Motivo 6 → "Ver todos los ejecutivos en este motivo" → ejecutivo → "Sus llamadas" → llamada en el minuto.
- **CUJ-3 (Qubico):** rol Qubico → Evaluadores → evaluador → "Detalle técnico" → Informes (con audiencia) → cambiar a Supervisor y comprobar que lo interno desaparece.

Revisado en el navegador: las rutas, Volver (`history`), los filtros, S-01/S-02/S-03/S-07, la pestaña y el informe ocultos para Supervisor, el minuto de la evidencia y el aviso sin evidencia. Sin errores de consola.

## 7c. Validación

### Evaluación heurística propia (Nielsen) con los datos reales

Severidad: 0 no es problema · 1 cosmético · 2 menor · 3 mayor · 4 catastrófico.

| # | Heurística | Hallazgo | Sev. | Cambio propuesto |
|---|---|---|---|---|
| HE-01 | 2 Coincidencia con el mundo real / 1 Visibilidad | **Motivo 18: IA 14 % y planilla 14 %, Diferencia ±0, pero "Se marca distinto".** En 20 de 100 llamadas no coinciden: solo 4 llamadas las marcan ambas. La diferencia agregada **esconde el desacuerdo llamada a llamada**, que es justo lo que importa (P-01) | **3** | Agregar la columna **"No coinciden"** (% de llamadas donde la IA y la planilla marcan distinto ese motivo) y ordenar por ella en vez de por \|Diferencia\| (pregunta 1) |
| HE-02 | 1 Visibilidad / 5 Prevención de errores | **Ejecutivos con muestra chica:** 44 ejecutivos con 6 llamadas como máximo, así que todos quedan con "pocas llamadas". La vista no permite concluir nada y puede inducir feedback injusto | **3** | Elegir el periodo de la foto (pregunta 2) y mostrar Ejecutivos solo cuando haya suficientes ejecutivos con 10 o más llamadas |
| HE-03 | 2 Mundo real | **Motivo 1 (espera):** IA 13 % y planilla 3 %. La IA aplica la regla de 30 s sobre `holds_sec` de la metadata y la planilla casi no lo marca. Es candidato a "Explicado por los datos" o a un criterio que la empresa aplica distinto | 2 | Confirmar con Verónica en la reunión (guion) y, si aplica, marcarlo como el 25 (D-10) |
| HE-04 | 8 Diseño minimalista | El filtro **Flujo** tiene un solo valor ("Intención de renuncia") | 1 | Ocultar un filtro con un solo valor y mostrarlo como texto en la banda |
| HE-05 | 4 Consistencia | En Evaluadores, la tabla general usa "motivos por cada 100 llamadas" y el detalle usa "% de sus llamadas" | 2 | Unificar en "% de sus llamadas por motivo" en el detalle y "promedio de motivos por llamada" en la general (ya usado en Cambio 20) |
| HE-06 | 4 Consistencia | "Evaluador" (esta sección, Cambio 20) frente a "Revisor" (métricas del prompt, §8 del glosario de call-audit) para la misma persona | 2 | Unificar (pregunta 3) |
| HE-07 | 10 Ayuda | Las ayudas bajo la tabla son largas (4 definiciones en un párrafo) | 1 | Lista corta con negrita, ya en el formato del Cambio 20 |
| HE-08 | 6 Reconocer antes que recordar | En la lista de llamadas, la fuente se ve solo en el título | 1 | Repetirla como chip junto al título |
| HE-09 | 3 Control y libertad | "Volver" depende del historial: si se abre una llamada por enlace directo, no hay a dónde volver | 2 | El banner enlaza a la cifra de origen construida con los parámetros (`from`, `criterion`, filtros), no a `history.back()` |
| HE-10 | 9 Recuperarse de errores | S-01 no dice cuándo corre el script | 1 | "…cuando se procese la próxima corrida o planilla. La última se procesó el {fecha}." si existe |
| HE-11 | 7 Flexibilidad | No hay forma de ordenar Ejecutivos por la planilla (D-22 fija la IA) | 0 | Se mantiene por D-22. Las columnas se pueden ordenar por clic en la versión real |

### Plan de test de usabilidad (en la reunión con Verónica, fecha pendiente)

- **Formato:** 20 minutos dentro de la reunión, moderado por Rodrigo, con el prototipo en pantalla y el rol Supervisor. Se combina con el guion de `01-investigacion.md` §7: primero las preguntas abiertas, después las tareas.
- **Tareas (de los CUJ):**
  1. "¿Qué motivo revisarías primero esta semana? ¿Por qué?" (CUJ-1; éxito: elige uno con desacuerdo alto y explica si es de los datos, del criterio o del ejecutivo).
  2. "Muéstrame una llamada donde la planilla marcó el motivo 8 y la IA no." (CUJ-1; éxito: llega a la llamada en 4 clics o menos).
  3. "Elige a un ejecutivo para darle feedback sobre el motivo 6 y abre una llamada de ejemplo." (CUJ-2; éxito: 2 clics desde la cifra, y nota el aviso de "pocas llamadas").
  4. "¿Qué dice el informe sobre los ejecutivos con menos rechazo? ¿Te sirve?" (lectura).
- **Métricas:** éxito por tarea (sí / con ayuda / no), tiempo por tarea, errores de interpretación (p. ej. leer "Diferencia ±0" como "están de acuerdo") y SUS de 10 ítems al final si el tiempo alcanza.
- **Guion del moderador:**
  - "Estamos probando la pantalla, no a ti."
  - "Piensa en voz alta."
  - No explicar cifras antes de que ella las interprete.
  - Anotar sus palabras para "evaluador", "motivo", "tipo" y "falla".
- **Qubico, antes de la reunión (CUJ-3):** Johannes recorre el rol Qubico y anota el tiempo de preparación (meta < 10 min, K-04 del brief).

### Lista de cambios

| ID | Cambio | Origen | Estado |
|---|---|---|---|
| C-01 | Columna "No coinciden" y nuevo orden por defecto en Motivos y en el detalle | HE-01 | Pregunta 1 |
| C-02 | Periodo de la foto y umbral para mostrar Ejecutivos | HE-02 | Pregunta 2 |
| C-03 | Motivo 1 como posible "Explicado por los datos" | HE-03 | Validar en la reunión |
| C-04 | Ocultar filtros de un solo valor | HE-04 | Se aplica en la Fase 8 |
| C-05 | Unidades consistentes en Evaluadores | HE-05 | Se aplica en la Fase 8 |
| C-06 | Unificar Evaluador / Revisor | HE-06 | Pregunta 3 |
| C-07 | Ayudas en lista corta; chip de la fuente en la lista de llamadas | HE-07, HE-08 | Se aplica en la Fase 8 |
| C-08 | El "Volver" del banner reconstruye la cifra de origen | HE-09 | Se aplica en la Fase 8 |
| C-09 | S-01 con la fecha de la última corrida procesada | HE-10 | Se aplica en la Fase 8 |
